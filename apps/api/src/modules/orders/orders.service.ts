import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { Repository, DataSource, In } from "typeorm";
import Redis from "ioredis";
import { Order, OrderItem, EventSeat } from "@urticketbuddy/db";
import { RedisScriptsWrapper, RedisKeys } from "@urticketbuddy/redis-scripts";
import {
  ErrorCode,
  CheckoutRequestSchema,
  OrderStatus,
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
  ) {}

  async checkout(dto: CheckoutDto): Promise<{
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
    // Validate schema
    const parsed = CheckoutRequestSchema.safeParse(dto);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid checkout request payload",
        details: parsed.error.issues,
      });
    }

    const { eventId, seatIds, paymentMethodToken } = parsed.data;
    const effectiveUserId = parsed.data.userId || "usr-anon";

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
      idempotencyKey: `checkout_${eventId}_${effectiveUserId}_${Date.now()}`,
    });

    if (!paymentResult.success) {
      throw new BadRequestException({
        code: ErrorCode.PAYMENT_FAILED,
        message: paymentResult.error || "Payment charge failed",
      });
    }

    // Step 3: Execute Redis confirm_sold.lua atomically
    const confirmRes = await this.redisScripts.confirmSold(
      eventId,
      effectiveUserId,
      seatIds,
      nowMs,
    );

    if (!confirmRes.success) {
      const isExpiredOrLost =
        confirmRes.code === "HOLD_EXPIRED" ||
        confirmRes.code === "SEAT_NOT_HELD_BY_YOU";
      throw new ConflictException({
        code: isExpiredOrLost ? confirmRes.code : ErrorCode.CONFLICT,
        message: `Failed to confirm seat lock in Redis: ${confirmRes.code}`,
      });
    }

    // Step 4: Open a TypeORM transaction (dataSource.transaction())
    const createdOrder = await this.dataSource.transaction(async (manager) => {
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

      savedOrder.items = orderItems;
      return savedOrder;
    });

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
      `Order ${createdOrder.id} completed successfully for user ${effectiveUserId}, total ${totalAmount} PKR`,
    );

    // Step 6: Return the completed Order details
    return {
      id: createdOrder.id,
      userId: createdOrder.userId,
      eventId: createdOrder.eventId,
      totalAmount: Number(createdOrder.totalAmount),
      currency: createdOrder.currency,
      status: createdOrder.status,
      paymentGatewayRef: createdOrder.paymentGatewayRef,
      items: (createdOrder.items || []).map((item) => ({
        id: item.id,
        orderId: item.orderId,
        eventSeatId: item.eventSeatId,
        price: Number(item.price),
      })),
      createdAt: createdOrder.createdAt,
      updatedAt: createdOrder.updatedAt,
    };
  }

  async getOrderById(id: string): Promise<Order> {
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

    return order;
  }
}
