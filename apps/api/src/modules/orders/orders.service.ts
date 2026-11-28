import {
  Injectable,
  Inject,
  Optional,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { Repository, DataSource, In } from "typeorm";
import Redis from "ioredis";
import { Order, OrderItem, EventSeat, Ticket } from "@urticketbuddy/db";
import { RedisScriptsWrapper, RedisKeys } from "@urticketbuddy/redis-scripts";
import {
  ErrorCode,
  CheckoutRequestSchema,
  OrderStatus,
  UserRole,
} from "@urticketbuddy/contracts";
import {
  DATA_SOURCE,
  ORDER_REPOSITORY,
  ORDER_ITEM_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
} from "../../database/database.tokens";
import { MockPaymentService } from "./payment/mock-payment.service";
import { BloomService } from "../../common/bloom/bloom.service";
import { CheckoutDto } from "./dto/checkout.dto";

export const DEFAULT_SEAT_PRICE = 1000;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @Inject(DATA_SOURCE)
    private readonly dataSource: DataSource,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: Repository<Order>,
    @Inject(ORDER_ITEM_REPOSITORY)
    private readonly orderItemRepository: Repository<OrderItem>,
    @Inject(EVENT_SEAT_REPOSITORY)
    private readonly eventSeatRepository: Repository<EventSeat>,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
    @Inject(REDIS_SCRIPTS_WRAPPER)
    private readonly redisScripts: RedisScriptsWrapper,
    private readonly paymentService: MockPaymentService,
    @Optional()
    private readonly bloomService?: BloomService,
  ) {}

  async checkout(
    userId: string,
    dto: CheckoutDto,
  ): Promise<{
    id: string;
    userId: string;
    eventId: string;
    totalAmount: number;
    currency: string;
    status: string;
    paymentGatewayRef: string | null;
    items: Array<{
      id: string;
      orderId: string;
      eventSeatId: string;
      price: number;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }> {
    if (!userId) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: "Authenticated user is required",
      });
    }

    // Extract idempotency key from DTO before strict schema validation
    const { idempotencyKey: effectiveIdempotencyKey, ...schemaPayload } = dto;

    // Validate schema against CheckoutRequestSchema (.strict())
    const parsed = CheckoutRequestSchema.safeParse(schemaPayload);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid checkout request payload",
        details: parsed.error.issues,
      });
    }

    const { eventId, seatIds, paymentMethodToken } = parsed.data;
    const effectiveUserId = userId;

    if (effectiveIdempotencyKey) {
      const cached = await this.redisClient.get(
        `idempotency:checkout:${effectiveIdempotencyKey}`,
      );
      if (cached) {
        this.logger.log(
          `Idempotency cache hit for key ${effectiveIdempotencyKey}`,
        );
        return JSON.parse(cached);
      }
    }

    // Step 1: Verify that the user currently holds these specific seats in Redis
    const nowMs = Date.now();
    const snapshot = await this.redisScripts.getSnapshot(eventId, nowMs);

    for (const seatId of seatIds) {
      const hold = snapshot.holds[seatId];
      if (!hold) {
        // Double-check lock key directly for ownership
        const currentLockOwner = await this.redisClient.get(
          RedisKeys.seatLock(eventId, seatId),
        );
        if (currentLockOwner && currentLockOwner !== effectiveUserId) {
          throw new ConflictException({
            code: ErrorCode.SEAT_NOT_HELD_BY_YOU,
            message: `Seat ${seatId} is held by another user`,
          });
        }
        throw new ConflictException({
          code: ErrorCode.HOLD_EXPIRED,
          message: `Hold on seat ${seatId} has expired or was not acquired`,
        });
      }

      if (hold.userId !== effectiveUserId) {
        throw new ConflictException({
          code: ErrorCode.SEAT_NOT_HELD_BY_YOU,
          message: `Seat ${seatId} is held by another user`,
        });
      }

      if (hold.expiresAt <= nowMs) {
        throw new ConflictException({
          code: ErrorCode.HOLD_EXPIRED,
          message: `Hold on seat ${seatId} has expired`,
        });
      }
    }

    // Verify seats exist in PostgreSQL
    const seats = await this.eventSeatRepository.find({
      where: { eventId, seatId: In(seatIds) },
    });

    if (seats.length !== seatIds.length) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "One or more requested seat IDs do not exist for this event",
      });
    }

    const seatPrice = DEFAULT_SEAT_PRICE;
    const totalAmount = seats.length * seatPrice;

    // Step 2: Invoke the mock payment gateway service to charge the user
    const paymentResult = await this.paymentService.processPayment({
      amount: totalAmount,
      currency: "PKR",
      paymentMethodToken,
      idempotencyKey:
        effectiveIdempotencyKey ||
        `checkout_${eventId}_${effectiveUserId}_${Date.now()}`,
    });

    if (!paymentResult.success) {
      throw new BadRequestException({
        code: ErrorCode.PAYMENT_FAILED,
        message: paymentResult.error || "Payment charge failed",
      });
    }

    // Step 3: Execute Redis confirm_sold.lua atomically with fresh post-payment timestamp
    const confirmRes = await this.redisScripts.confirmSold(
      eventId,
      effectiveUserId,
      seatIds,
      Date.now(),
    );

    if (!confirmRes.success) {
      const isExpiredOrLost =
        confirmRes.code === "HOLD_EXPIRED" ||
        confirmRes.code === "SEAT_NOT_HELD_BY_YOU";
      this.logger.error(
        `CRITICAL: Payment ${paymentResult.transactionId ?? "unknown"} succeeded for user ${effectiveUserId} on event ${eventId}, but confirmSold failed with ${confirmRes.code} — compensating refund required`,
      );
      if (paymentResult.transactionId) {
        try {
          await this.paymentService.refundPayment({
            transactionId: paymentResult.transactionId,
            amount: totalAmount,
            reason: `Seat confirmation failed: ${confirmRes.code}`,
          });
          this.logger.log(
            `Compensating refund issued for transaction ${paymentResult.transactionId}`,
          );
        } catch (refundErr) {
          this.logger.error(
            `Failed to issue compensating refund for ${paymentResult.transactionId}: ${refundErr instanceof Error ? refundErr.message : String(refundErr)}`,
          );
        }
      }
      throw new ConflictException({
        code: isExpiredOrLost ? confirmRes.code : ErrorCode.CONFLICT,
        message: `Failed to confirm seat lock in Redis: ${confirmRes.code}`,
      });
    }

    // Step 4: Open a TypeORM transaction (dataSource.transaction())
    let createdOrder;
    try {
      createdOrder = await this.dataSource.transaction(async (manager) => {
        // Pessimistic write lock on EventSeat rows to serialize concurrent updates
        const lockedSeats = await manager.find(EventSeat, {
          where: { id: In(seats.map((s) => s.id)) },
          lock: { mode: "pessimistic_write" },
        });

        const alreadySold = lockedSeats.filter((s) => s.status === "SOLD");
        if (alreadySold.length > 0) {
          throw new ConflictException({
            code: ErrorCode.CONFLICT,
            message: "One or more seats have already been sold in the database",
          });
        }

        // Create Order
        const order = manager.create(Order, {
          userId: effectiveUserId,
          eventId,
          totalAmount,
          currency: "PKR",
          status: OrderStatus.COMPLETED,
          paymentGatewayRef: paymentResult.transactionId ?? null,
        });
        const savedOrder = await manager.save(Order, order);

        // Create OrderItems
        const orderItems = seats.map((seat) =>
          manager.create(OrderItem, {
            orderId: savedOrder.id,
            eventSeatId: seat.id,
            price: seatPrice,
          }),
        );
        await manager.save(OrderItem, orderItems);

        // Update corresponding EventSeats to SOLD in PostgreSQL
        await manager.update(
          EventSeat,
          { id: In(seats.map((s) => s.id)) },
          { status: "SOLD" },
        );

        // Create and save Ticket records for each purchased seat
        const tickets = seats.map((seat) =>
          manager.create(Ticket, {
            eventId,
            eventSeatId: seat.id,
            orderId: savedOrder.id,
            ownerId: effectiveUserId,
            status: "ISSUED",
            seedVersion: 1,
            faceValueMinor: seatPrice * 100,
          }),
        );
        const savedTickets = await manager.save(Ticket, tickets);

        savedOrder.items = orderItems;
        return { order: savedOrder, tickets: savedTickets };
      });
    } catch (dbErr) {
      this.logger.error(
        `Checkout DB transaction failed for user ${effectiveUserId} on event ${eventId}: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`,
      );
      if (paymentResult.transactionId) {
        try {
          await this.paymentService.refundPayment({
            transactionId: paymentResult.transactionId,
            amount: totalAmount,
            reason: `Database transaction failed: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`,
          });
        } catch (refundErr) {
          this.logger.error(
            `Failed to issue compensating refund for ${paymentResult.transactionId}: ${refundErr instanceof Error ? refundErr.message : String(refundErr)}`,
          );
        }
      }
      try {
        await this.redisScripts.unsellSeats(eventId, seatIds);
      } catch (unsellErr) {
        this.logger.error(
          `Failed to rollback Redis sold state for event ${eventId}: ${unsellErr instanceof Error ? unsellErr.message : String(unsellErr)}`,
        );
      }
      throw dbErr;
    }

    // Register tickets in RedisBloom ticket prefilter
    if (this.bloomService && createdOrder.tickets) {
      for (const ticket of createdOrder.tickets) {
        await this.bloomService.add(ticket.id);
      }
    }

    // Step 5: Publish a Redis Pub/Sub event on seat-updates:{eventId} with state SOLD
    for (const seatId of seatIds) {
      const payload = JSON.stringify({
        eventId,
        seatId,
        state: "SOLD",
        userId: effectiveUserId,
      });

      try {
        await this.redisClient.publish(`seat-updates:${eventId}`, payload);
        await this.redisClient.publish("seat.state", payload);
      } catch (err) {
        this.logger.warn(
          `Failed to publish Redis seat-updates event: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.logger.log(
      `Order ${createdOrder.order.id} completed successfully for user ${effectiveUserId}, total ${totalAmount} PKR`,
    );

    // Step 6: Return the completed Order details
    const result = {
      id: createdOrder.order.id,
      userId: createdOrder.order.userId,
      eventId: createdOrder.order.eventId,
      totalAmount: Number(createdOrder.order.totalAmount),
      currency: createdOrder.order.currency,
      status: createdOrder.order.status,
      paymentGatewayRef: createdOrder.order.paymentGatewayRef,
      items: (createdOrder.order.items || []).map((item) => ({
        id: item.id,
        orderId: item.orderId,
        eventSeatId: item.eventSeatId,
        price: Number(item.price),
      })),
      createdAt: createdOrder.order.createdAt,
      updatedAt: createdOrder.order.updatedAt,
    };

    if (effectiveIdempotencyKey) {
      try {
        await this.redisClient.set(
          `idempotency:checkout:${effectiveIdempotencyKey}`,
          JSON.stringify(result),
          "EX",
          86400,
        );
      } catch (cacheErr) {
        this.logger.warn(
          `Failed to cache idempotency result for key ${effectiveIdempotencyKey}: ${cacheErr instanceof Error ? cacheErr.message : String(cacheErr)}`,
        );
      }
    }

    return result;
  }

  async getOrderById(
    id: string,
    requester?: { id?: string; userId?: string; role?: string },
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ["items", "event"],
    });

    if (!order) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `Order with id ${id} not found`,
      });
    }

    if (requester && requester.role !== UserRole.ADMIN) {
      const callerId = requester.id || requester.userId;
      if (!callerId || order.userId !== callerId) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: "Forbidden: you do not own this order",
        });
      }
    }

    return order;
  }
}
