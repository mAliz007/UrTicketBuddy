import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateResaleListingSchema,
  ErrorCode,
  LedgerEntryKind,
  maxResalePrice,
  PaginationQuerySchema,
  PurchaseResaleListingSchema,
  ResaleListingStatus,
  TicketStatus,
  UpdateResaleListingSchema,
} from "@urticketbuddy/contracts";
import { LedgerEntry, ResaleListing, Ticket } from "@urticketbuddy/db";
import Redis from "ioredis";
import { DataSource, QueryFailedError, Repository } from "typeorm";
import {
  PLATFORM_SETTINGS_PORT,
  PlatformSettingsPort,
} from "../../common/ports";
import {
  DATA_SOURCE,
  REDIS_CLIENT,
  RESALE_LISTING_REPOSITORY,
  TICKET_REPOSITORY,
} from "../../database/database.tokens";
import { MockPaymentService } from "../orders/payment/mock-payment.service";

export interface TicketTransferredEvent {
  ticketId: string;
  eventId: string;
  listingId: string;
  previousOwnerId: string;
  newOwnerId: string;
  seedVersion: number;
  askingPriceMinor: number;
  transferredAt: string;
}

const RESALE_LOCK_TTL_SECONDS = 300;
const IDEMPOTENCY_TTL_SECONDS = 86_400;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RELEASE_RESALE_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

@Injectable()
export class ResaleService {
  private readonly logger = new Logger(ResaleService.name);

  constructor(
    @Inject(DATA_SOURCE) private readonly dataSource: DataSource,
    @Inject(RESALE_LISTING_REPOSITORY)
    private readonly resaleListingRepository: Repository<ResaleListing>,
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepository: Repository<Ticket>,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    @Inject(PLATFORM_SETTINGS_PORT)
    private readonly platformSettings: PlatformSettingsPort,
    private readonly paymentService: MockPaymentService,
  ) {}

  async createListing(sellerId: string, rawBody: unknown) {
    const parsed = CreateResaleListingSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid resale listing payload",
        details: parsed.error.flatten(),
      });
    }

    const { ticketId, askingPriceMinor } = parsed.data;

    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: ["event"],
    });

    if (!ticket) {
      throw new NotFoundException({
        code: ErrorCode.TICKET_NOT_FOUND,
        message: `Ticket ${ticketId} not found`,
      });
    }

    if (ticket.ownerId !== sellerId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: "You do not own this ticket",
      });
    }

    if (ticket.status !== TicketStatus.ISSUED) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: `Ticket with status ${ticket.status} cannot be listed for resale`,
      });
    }

    if (ticket.event && ticket.event.startTime.getTime() <= Date.now()) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: "Cannot list ticket after the event has started",
      });
    }

    const maxAllowed = maxResalePrice(ticket.faceValueMinor);
    if (askingPriceMinor > maxAllowed) {
      throw new BadRequestException({
        code: ErrorCode.RESALE_PRICE_CAP_EXCEEDED,
        message: `Asking price ${askingPriceMinor} exceeds 110% cap (${maxAllowed})`,
      });
    }

    const existingActive = await this.resaleListingRepository.findOne({
      where: {
        ticketId,
        status: ResaleListingStatus.ACTIVE,
      },
    });

    if (existingActive) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: "An active resale listing already exists for this ticket",
      });
    }

    const listing = this.resaleListingRepository.create({
      ticketId,
      eventId: ticket.eventId,
      sellerId,
      askingPriceMinor,
      status: ResaleListingStatus.ACTIVE,
    });

    try {
      return await this.resaleListingRepository.save(listing);
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err.driverError as { code?: string } | undefined)?.code === "23505"
      ) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: "An active resale listing already exists for this ticket",
        });
      }
      throw err;
    }
  }

  async updateListing(listingId: string, sellerId: string, rawBody: unknown) {
    const parsed = UpdateResaleListingSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid resale listing update payload",
        details: parsed.error.flatten(),
      });
    }

    const activeLockOwner = await this.redisClient.get(
      `resale_lock:${listingId}`,
    );
    if (activeLockOwner) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message:
          "Resale listing cannot be modified while a purchase is in progress",
      });
    }

    const listing = await this.resaleListingRepository.findOne({
      where: { id: listingId },
      relations: ["ticket"],
    });

    if (!listing) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `Resale listing ${listingId} not found`,
      });
    }

    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: "Only the seller can update this listing",
      });
    }

    if (listing.status !== ResaleListingStatus.ACTIVE) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: `Cannot update listing with status ${listing.status}`,
      });
    }

    const { askingPriceMinor, status } = parsed.data;

    if (askingPriceMinor !== undefined) {
      const maxAllowed = maxResalePrice(listing.ticket.faceValueMinor);
      if (askingPriceMinor > maxAllowed) {
        throw new BadRequestException({
          code: ErrorCode.RESALE_PRICE_CAP_EXCEEDED,
          message: `Asking price ${askingPriceMinor} exceeds 110% cap (${maxAllowed})`,
        });
      }

      if (askingPriceMinor > listing.askingPriceMinor) {
        throw new BadRequestException({
          code: ErrorCode.RESALE_PRICE_CAP_EXCEEDED,
          message: "Resale asking price can only be lowered, not raised",
        });
      }

      listing.askingPriceMinor = askingPriceMinor;
    }

    if (status === ResaleListingStatus.WITHDRAWN) {
      listing.status = ResaleListingStatus.WITHDRAWN;
    }

    return this.resaleListingRepository.save(listing);
  }

  async getListings(query: {
    eventId?: string;
    page?: unknown;
    pageSize?: unknown;
  }) {
    const pagination = PaginationQuerySchema.safeParse({
      page: query.page,
      pageSize: query.pageSize,
    });

    if (!pagination.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid pagination parameters",
        details: pagination.error.flatten(),
      });
    }

    if (query.eventId !== undefined && !UUID_REGEX.test(query.eventId)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid eventId filter",
      });
    }

    const { page, pageSize } = pagination.data;
    const qb = this.resaleListingRepository
      .createQueryBuilder("listing")
      .innerJoin("listing.event", "event")
      .where("listing.status = :status", {
        status: ResaleListingStatus.ACTIVE,
      })
      .andWhere("event.startTime > :now", { now: new Date() });

    if (query.eventId) {
      qb.andWhere("listing.eventId = :eventId", { eventId: query.eventId });
    }

    const [items, total] = await qb
      .orderBy("listing.createdAt", "DESC")
      .addOrderBy("listing.id", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items,
      page,
      pageSize,
      total,
    };
  }

  async purchaseListing(
    listingId: string,
    buyerId: string,
    rawBody: unknown,
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Idempotency-Key header is required",
      });
    }

    const parsed = PurchaseResaleListingSchema.safeParse(rawBody ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid purchase payload",
        details: parsed.error.flatten(),
      });
    }

    const idempotencyCacheKey = `resale_idem:${listingId}:${buyerId}:${idempotencyKey}`;
    const cachedResponse = await this.redisClient.get(idempotencyCacheKey);
    if (cachedResponse) {
      return JSON.parse(cachedResponse) as Record<string, unknown>;
    }

    const lockKey = `resale_lock:${listingId}`;
    const lockAcquired = await this.redisClient.set(
      lockKey,
      buyerId,
      "EX",
      RESALE_LOCK_TTL_SECONDS,
      "NX",
    );

    if (lockAcquired !== "OK") {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: "Resale listing is currently locked by another buyer",
      });
    }

    try {
      const listing = await this.resaleListingRepository.findOne({
        where: { id: listingId },
      });

      if (!listing) {
        throw new NotFoundException({
          code: ErrorCode.NOT_FOUND,
          message: `Resale listing ${listingId} not found`,
        });
      }

      if (listing.status !== ResaleListingStatus.ACTIVE) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: `Resale listing is no longer active (${listing.status})`,
        });
      }

      if (listing.sellerId === buyerId) {
        throw new ConflictException({
          code: ErrorCode.CONFLICT,
          message: "Seller cannot purchase their own resale listing",
        });
      }

      const paymentResult = await this.paymentService.processPayment({
        amount: listing.askingPriceMinor,
        currency: "PKR",
        paymentMethodToken: parsed.data.paymentMethodToken,
        idempotencyKey,
      });

      if (!paymentResult.success) {
        throw new BadRequestException({
          code: ErrorCode.PAYMENT_FAILED,
          message: paymentResult.error || "Resale payment failed",
        });
      }

      const commissionRateBps =
        await this.platformSettings.getCommissionRateBps();

      let result;
      try {
        result = await this.dataSource.transaction(async (manager) => {
          const lockedListing = await manager.findOne(ResaleListing, {
            where: { id: listingId },
            lock: { mode: "pessimistic_write" },
          });

          if (
            !lockedListing ||
            lockedListing.status !== ResaleListingStatus.ACTIVE
          ) {
            throw new ConflictException({
              code: ErrorCode.CONFLICT,
              message: "Resale listing is no longer active",
            });
          }

          const lockedTicket = await manager.findOne(Ticket, {
            where: { id: lockedListing.ticketId },
            lock: { mode: "pessimistic_write" },
          });

          if (!lockedTicket || lockedTicket.status !== TicketStatus.ISSUED) {
            throw new ConflictException({
              code: ErrorCode.CONFLICT,
              message: "Ticket is no longer eligible for resale transfer",
            });
          }

          const commissionMinor = Math.floor(
            (lockedListing.askingPriceMinor * commissionRateBps) / 10000,
          );
          const sellerPayoutMinor =
            lockedListing.askingPriceMinor - commissionMinor;

          const commissionEntry = manager.create(LedgerEntry, {
            listingId: lockedListing.id,
            account: "platform:commission",
            amountMinor: commissionMinor,
            kind: LedgerEntryKind.PLATFORM_COMMISSION,
          });

          const sellerPayoutEntry = manager.create(LedgerEntry, {
            listingId: lockedListing.id,
            account: `seller:${lockedListing.sellerId}`,
            amountMinor: sellerPayoutMinor,
            kind: LedgerEntryKind.SELLER_PAYOUT,
          });

          await manager.save(LedgerEntry, [commissionEntry, sellerPayoutEntry]);

          const previousOwnerId = lockedTicket.ownerId;
          lockedTicket.ownerId = buyerId;
          lockedTicket.seedVersion += 1;
          await manager.save(Ticket, lockedTicket);

          lockedListing.status = ResaleListingStatus.SOLD;
          await manager.save(ResaleListing, lockedListing);

          return {
            listingId: lockedListing.id,
            ticketId: lockedTicket.id,
            eventId: lockedListing.eventId,
            previousOwnerId,
            buyerId,
            askingPriceMinor: lockedListing.askingPriceMinor,
            commissionMinor,
            sellerPayoutMinor,
            seedVersion: lockedTicket.seedVersion,
            status: lockedListing.status,
            transactionId: paymentResult.transactionId,
          };
        });
      } catch (err) {
        if (paymentResult.transactionId) {
          await this.paymentService
            .refundPayment({
              transactionId: paymentResult.transactionId,
              amount: listing.askingPriceMinor,
              reason: err instanceof Error ? err.message : "DB commit failed",
            })
            .catch((refundErr) => {
              this.logger.error(
                `CRITICAL: Compensating refund failed for transaction ${paymentResult.transactionId}: ${refundErr instanceof Error ? refundErr.message : String(refundErr)}`,
              );
            });
        }
        throw err;
      }

      await this.redisClient
        .set(
          idempotencyCacheKey,
          JSON.stringify(result),
          "EX",
          IDEMPOTENCY_TTL_SECONDS,
        )
        .catch(() => undefined);

      const transferredEvent: TicketTransferredEvent = {
        ticketId: result.ticketId,
        eventId: result.eventId,
        listingId: result.listingId,
        previousOwnerId: result.previousOwnerId,
        newOwnerId: result.buyerId,
        seedVersion: result.seedVersion,
        askingPriceMinor: result.askingPriceMinor,
        transferredAt: new Date().toISOString(),
      };
      this.logger.log(`ticket.transferred ${JSON.stringify(transferredEvent)}`);

      return result;
    } finally {
      await this.redisClient
        .eval(RELEASE_RESALE_LOCK_LUA, 1, lockKey, buyerId)
        .catch(() => undefined);
    }
  }
}
