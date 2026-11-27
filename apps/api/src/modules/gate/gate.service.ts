import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Repository, MoreThan } from "typeorm";
import Redis from "ioredis";
import { Ticket, GateScan, Event } from "@urticketbuddy/db";
import {
  ScanResult,
  TicketStatus,
  UserRole,
  ErrorCode,
  GateScanResponse,
  GateMetricsResponse,
  GateScanRequestSchema,
} from "@urticketbuddy/contracts";
import {
  TICKET_REPOSITORY,
  GATE_SCAN_REPOSITORY,
  EVENT_REPOSITORY,
  REDIS_CLIENT,
} from "../../database/database.tokens";
import { BloomService } from "../../common/bloom/bloom.service";
import { TicketsService } from "../tickets/tickets.service";
import { ScanTicketDto } from "./dto/scan-ticket.dto";

@Injectable()
export class GateService {
  private readonly logger = new Logger(GateService.name);

  constructor(
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepository: Repository<Ticket>,
    @Inject(GATE_SCAN_REPOSITORY)
    private readonly gateScanRepository: Repository<GateScan>,
    @Inject(EVENT_REPOSITORY)
    private readonly eventRepository: Repository<Event>,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
    private readonly bloomService: BloomService,
    private readonly ticketsService: TicketsService,
  ) {}

  /**
   * Helper to persist a gate scan audit record.
   * Ensures ticketId is null when unverified/forged to avoid foreign key violations,
   * and safely truncates scannedTicketRef to 255 characters.
   */
  async recordScan(params: {
    ticketId: string | null;
    scannedTicketRef?: string | null;
    eventId: string;
    scannedBy: string;
    result: ScanResult;
  }): Promise<GateScan> {
    const rawRef = params.scannedTicketRef ?? params.ticketId ?? null;
    const safeRef = rawRef ? String(rawRef).substring(0, 255) : null;

    try {
      const scan = this.gateScanRepository.create({
        ticketId: params.ticketId,
        scannedTicketRef: safeRef,
        eventId: params.eventId,
        scannedBy: params.scannedBy,
        result: params.result,
        scannedAt: new Date(),
      });
      return await this.gateScanRepository.save(scan);
    } catch (err) {
      this.logger.error(
        `Failed to record gate scan audit: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      // Return a pseudo record if database insert fails
      return {
        id: "audit-failed",
        ticketId: params.ticketId,
        scannedTicketRef: safeRef,
        eventId: params.eventId,
        scannedBy: params.scannedBy,
        result: params.result,
        scannedAt: new Date(),
      } as GateScan;
    }
  }

  /**
   * Scans and validates a dynamic QR token at the gate.
   *
   * Multi-stage pipeline:
   * 0. Verify event existence & organizer tenant isolation
   * 1. Decode token payload
   * 2. RedisBloom prefilter check (rejects forged/unregistered tokens with ZERO PostgreSQL queries)
   * 3. PostgreSQL ticket lookup
   * 4. Verify event match
   * 5. Early status check (CHECKED_IN, REVOKED, VOID)
   * 6. Cryptographic HMAC & time window verification
   * 7. Distributed per-ticket concurrency scan lock (`scan_lock:<ticketId>`)
   * 8. Redis replay protection (`qr_nonce:<ticketId>:<window>`)
   * 9. Atomic conditional update (ISSUED + seedVersion -> CHECKED_IN) with nonce rollback on unexpected DB errors
   */
  async scanTicket(
    dto: ScanTicketDto,
    scannedBy: string,
    scannerUser?: {
      id?: string;
      role?: string;
      organizerTenantId?: string | null;
    },
  ): Promise<GateScanResponse> {
    const parsed = GateScanRequestSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid gate scan request payload",
        details: parsed.error.issues,
      });
    }

    const { token, eventId } = parsed.data;

    // 0. Verify event existence & organizer tenant isolation
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new BadRequestException({
        code: ErrorCode.NOT_FOUND,
        message: `Event ${eventId} not found`,
      });
    }

    const eventOrganizerId = (event as Event & { organizerId?: string })
      .organizerId;
    if (scannerUser && scannerUser.role !== UserRole.ADMIN) {
      const organizerTenantId = scannerUser.organizerTenantId;
      const scannerId = scannerUser.id;
      if (scannerUser.role === UserRole.GATE_STAFF) {
        if (
          !organizerTenantId ||
          !eventOrganizerId ||
          eventOrganizerId !== organizerTenantId
        ) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: "Forbidden: Event belongs to a different organizer",
          });
        }
      } else {
        const callerTenantId = organizerTenantId || scannerId;
        if (
          !eventOrganizerId ||
          !callerTenantId ||
          (eventOrganizerId !== organizerTenantId &&
            eventOrganizerId !== scannerId)
        ) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: "Forbidden: Event belongs to a different organizer",
          });
        }
      }
    }

    // 1. Decode token payload
    let ticketId: string;
    let windowStr: string;
    try {
      const decoded = Buffer.from(token, "base64url").toString("utf8");
      const parts = decoded.split(".");
      if (parts.length !== 3) {
        throw new Error("Invalid token segment count");
      }
      [ticketId, windowStr] = parts;
      if (!ticketId || !windowStr) {
        throw new Error("Missing ticketId or window");
      }
    } catch {
      await this.recordScan({
        ticketId: null,
        scannedTicketRef: "malformed-token",
        eventId,
        scannedBy,
        result: ScanResult.INVALID,
      });
      throw new BadRequestException({
        code: ErrorCode.TICKET_INVALID,
        message: "Malformed QR token structure",
      });
    }

    // 2. RedisBloom prefilter check
    // Reject definite non-existent/forged tickets WITHOUT querying PostgreSQL
    const mightExist = await this.bloomService.mightExist(ticketId);
    if (!mightExist) {
      this.logger.warn(
        `Bloom prefilter rejected forged/unknown ticketId ${ticketId} without querying PostgreSQL.`,
      );
      // ticketId is not in DB: pass ticketId: null and scannedTicketRef: ticketId to avoid FK violation
      await this.recordScan({
        ticketId: null,
        scannedTicketRef: ticketId,
        eventId,
        scannedBy,
        result: ScanResult.INVALID,
      });
      throw new BadRequestException({
        code: ErrorCode.TICKET_NOT_FOUND,
        message: "Invalid or forged ticket",
      });
    }

    // 3. PostgreSQL ticket lookup
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    if (!ticket) {
      // Bloom filter false positive or deleted ticket: pass ticketId: null to avoid FK violation
      await this.recordScan({
        ticketId: null,
        scannedTicketRef: ticketId,
        eventId,
        scannedBy,
        result: ScanResult.INVALID,
      });
      throw new BadRequestException({
        code: ErrorCode.TICKET_NOT_FOUND,
        message: "Ticket not found in system",
      });
    }

    // 4. Verify event match
    if (ticket.eventId !== eventId) {
      await this.recordScan({
        ticketId: ticket.id,
        scannedTicketRef: ticket.id,
        eventId,
        scannedBy,
        result: ScanResult.WRONG_EVENT,
      });
      throw new BadRequestException({
        code: ErrorCode.WRONG_EVENT,
        message: "Ticket is not valid for this event",
      });
    }

    // 5. Early status check (differentiate CHECKED_IN, REVOKED, VOID)
    if (ticket.status === TicketStatus.CHECKED_IN) {
      await this.recordScan({
        ticketId: ticket.id,
        scannedTicketRef: ticket.id,
        eventId,
        scannedBy,
        result: ScanResult.USED,
      });
      throw new ConflictException({
        code: ErrorCode.TICKET_ALREADY_USED,
        message: "Ticket has already been checked in",
      });
    }

    if (ticket.status === TicketStatus.REVOKED) {
      await this.recordScan({
        ticketId: ticket.id,
        scannedTicketRef: ticket.id,
        eventId,
        scannedBy,
        result: ScanResult.INVALID,
      });
      throw new ConflictException({
        code: ErrorCode.TICKET_INVALID,
        message: "Ticket has been revoked",
      });
    }

    if (ticket.status === TicketStatus.VOID) {
      await this.recordScan({
        ticketId: ticket.id,
        scannedTicketRef: ticket.id,
        eventId,
        scannedBy,
        result: ScanResult.INVALID,
      });
      throw new ConflictException({
        code: ErrorCode.TICKET_INVALID,
        message: "Ticket is void",
      });
    }

    if (ticket.status !== TicketStatus.ISSUED) {
      await this.recordScan({
        ticketId: ticket.id,
        scannedTicketRef: ticket.id,
        eventId,
        scannedBy,
        result: ScanResult.INVALID,
      });
      throw new ConflictException({
        code: ErrorCode.TICKET_INVALID,
        message: `Ticket is not valid for entry (current status: ${ticket.status})`,
      });
    }

    // 6. Cryptographic signature and window verification
    const verification = this.ticketsService.verifyToken(token, ticket);
    if (!verification.valid) {
      const result = verification.isExpired
        ? ScanResult.EXPIRED
        : ScanResult.INVALID;
      await this.recordScan({
        ticketId: ticket.id,
        scannedTicketRef: ticket.id,
        eventId,
        scannedBy,
        result,
      });
      throw new BadRequestException({
        code: verification.isExpired
          ? ErrorCode.TICKET_EXPIRED
          : ErrorCode.TICKET_INVALID,
        message: verification.reason || "Token verification failed",
      });
    }

    // 7. Distributed per-ticket concurrency scan lock (prevents concurrent scans across turnstiles & adjacent windows)
    const scanLockKey = `scan_lock:${ticketId}`;
    const scanLockAcquired = await this.redisClient.set(
      scanLockKey,
      "1",
      "EX",
      5,
      "NX",
    );

    if (!scanLockAcquired) {
      this.logger.warn(
        `Concurrent turnstile scan conflict detected for ticket ${ticketId}`,
      );
      throw new ConflictException({
        code: ErrorCode.TICKET_ALREADY_USED,
        message: "Ticket is currently being processed at another turnstile",
      });
    }

    try {
      // 8. Redis replay protection (qr_nonce:<ticketId>:<window> = SET NX EX 60)
      const nonceKey = `qr_nonce:${ticketId}:${verification.window}`;
      const nonceAcquired = await this.redisClient.set(
        nonceKey,
        "1",
        "EX",
        60,
        "NX",
      );

      if (!nonceAcquired) {
        this.logger.warn(
          `Replay attack detected for ticket ${ticketId} in window ${verification.window}`,
        );
        await this.recordScan({
          ticketId: ticket.id,
          scannedTicketRef: ticket.id,
          eventId,
          scannedBy,
          result: ScanResult.USED,
        });
        throw new ConflictException({
          code: ErrorCode.TICKET_ALREADY_USED,
          message: "Ticket QR token was already scanned (replay detected)",
        });
      }

      // 9. Atomic conditional update (ISSUED + seedVersion -> CHECKED_IN)
      try {
        const updateRes = await this.ticketRepository.update(
          {
            id: ticketId,
            status: TicketStatus.ISSUED,
            seedVersion: ticket.seedVersion,
          },
          { status: TicketStatus.CHECKED_IN },
        );

        if (!updateRes.affected || updateRes.affected === 0) {
          // Check if failure was due to concurrent seed rotation vs ticket already checked in
          const fresh = await this.ticketRepository.findOne({
            where: { id: ticketId },
          });

          if (fresh && fresh.seedVersion !== ticket.seedVersion) {
            this.logger.warn(
              `Ticket ${ticketId} seedVersion changed from ${ticket.seedVersion} to ${fresh.seedVersion} during scan.`,
            );
            await this.recordScan({
              ticketId: ticket.id,
              scannedTicketRef: ticket.id,
              eventId,
              scannedBy,
              result: ScanResult.INVALID,
            });
            throw new BadRequestException({
              code: ErrorCode.TICKET_INVALID,
              message:
                "Ticket key was rotated during verification; token is invalid",
            });
          }

          await this.recordScan({
            ticketId: ticket.id,
            scannedTicketRef: ticket.id,
            eventId,
            scannedBy,
            result: ScanResult.USED,
          });
          throw new ConflictException({
            code: ErrorCode.TICKET_ALREADY_USED,
            message: "Ticket is no longer in ISSUED state (already checked in)",
          });
        }
      } catch (err) {
        // If error was NOT a ConflictException or BadRequestException (e.g. transient DB error), release nonce so patron isn't locked out
        if (
          !(err instanceof ConflictException) &&
          !(err instanceof BadRequestException)
        ) {
          try {
            await this.redisClient.del(nonceKey);
          } catch (delErr) {
            this.logger.error(
              `Failed to rollback nonce ${nonceKey}: ${delErr}`,
            );
          }
        }
        throw err;
      }

      // 10. Record valid gate scan audit
      const scan = await this.recordScan({
        ticketId: ticket.id,
        scannedTicketRef: ticket.id,
        eventId,
        scannedBy,
        result: ScanResult.VALID,
      });

      this.logger.log(
        `Ticket ${ticketId} successfully checked in at gate by ${scannedBy}`,
      );

      return {
        scanId: scan.id,
        ticketId: ticket.id,
        eventId: ticket.eventId,
        result: ScanResult.VALID,
        scannedAt: scan.scannedAt.toISOString(),
        message: "Ticket checked in successfully",
        seatId: ticket.eventSeatId,
      };
    } finally {
      try {
        await this.redisClient.del(scanLockKey);
      } catch (lockErr) {
        this.logger.error(
          `Failed to release scan lock ${scanLockKey}: ${lockErr}`,
        );
      }
    }
  }

  /**
   * Calculates entry metrics for an event.
   */
  async getMetrics(
    eventId: string,
    scannerUser?: {
      id?: string;
      role?: string;
      organizerTenantId?: string | null;
    },
  ): Promise<GateMetricsResponse> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });
    if (!event) {
      throw new BadRequestException({
        code: ErrorCode.NOT_FOUND,
        message: `Event ${eventId} not found`,
      });
    }

    const eventOrganizerId = (event as Event & { organizerId?: string })
      .organizerId;
    if (scannerUser && scannerUser.role !== UserRole.ADMIN) {
      const organizerTenantId = scannerUser.organizerTenantId;
      const scannerId = scannerUser.id;
      if (scannerUser.role === UserRole.GATE_STAFF) {
        if (
          !organizerTenantId ||
          !eventOrganizerId ||
          eventOrganizerId !== organizerTenantId
        ) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: "Forbidden: Event belongs to a different organizer",
          });
        }
      } else {
        const callerTenantId = organizerTenantId || scannerId;
        if (
          !eventOrganizerId ||
          !callerTenantId ||
          (eventOrganizerId !== organizerTenantId &&
            eventOrganizerId !== scannerId)
        ) {
          throw new ForbiddenException({
            code: ErrorCode.FORBIDDEN,
            message: "Forbidden: Event belongs to a different organizer",
          });
        }
      }
    }

    const totalScans = await this.gateScanRepository.count({
      where: { eventId },
    });

    const validScans = await this.gateScanRepository.count({
      where: { eventId, result: ScanResult.VALID },
    });

    const rejectedScans = totalScans - validScans;

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentValidScans = await this.gateScanRepository.count({
      where: {
        eventId,
        result: ScanResult.VALID,
        scannedAt: MoreThan(fiveMinutesAgo),
      },
    });

    const entryVelocityPerMinute =
      Math.round((recentValidScans / 5) * 100) / 100;

    return {
      eventId,
      totalScans,
      validScans,
      rejectedScans,
      entryVelocityPerMinute,
    };
  }
}
