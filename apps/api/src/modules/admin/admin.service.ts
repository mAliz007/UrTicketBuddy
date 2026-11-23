import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Repository, DataSource } from "typeorm";
import Redis from "ioredis";
import { randomUUID } from "crypto";
import {
  Order,
  Ticket,
  EventSeat,
  User,
  RefreshToken,
} from "@urticketbuddy/db";
import {
  OrderStatus,
  TicketStatus,
  SeatState,
  UserRole,
  ErrorCode,
  AuditLogQuery,
  PaginatedAuditLogs,
  FlagOrderResponse,
  RevokeTicketResponse,
  CommissionSettingsResponse,
} from "@urticketbuddy/contracts";
import { RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";
import {
  DATA_SOURCE,
  ORDER_REPOSITORY,
  TICKET_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  USER_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
} from "../../database/database.tokens";
import { AuditService } from "./audit.service";
import { PlatformSettingsService } from "./platform-settings.service";

export interface AdminActor {
  id?: string;
  userId?: string;
  email?: string;
  role?: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @Inject(DATA_SOURCE)
    private readonly dataSource: DataSource,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: Repository<Order>,
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepository: Repository<Ticket>,
    @Inject(EVENT_SEAT_REPOSITORY)
    private readonly eventSeatRepository: Repository<EventSeat>,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: Repository<User>,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
    @Inject(REDIS_SCRIPTS_WRAPPER)
    private readonly redisScriptsWrapper: RedisScriptsWrapper,
    private readonly auditService: AuditService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  /**
   * Helper to normalize admin actor details for audit logs
   */
  private extractActor(adminUser: AdminActor) {
    const actorId =
      adminUser.id || adminUser.userId || adminUser.email || "admin";
    const actorRole = adminUser.role || UserRole.ADMIN;
    return { actorId, actorRole };
  }

  /**
   * Flags an order as fraudulent, increments seedVersion on all of its tickets
   * to invalidate their dynamic HMAC-SHA256 QR tokens, and records an audit log.
   */
  async flagOrder(
    orderId: string,
    adminUser: AdminActor,
    reason?: string,
    ipAddress?: string,
  ): Promise<FlagOrderResponse> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `Order ${orderId} not found`,
      });
    }

    const previousStatus = order.status;
    order.status = OrderStatus.FLAGGED;

    // Find and invalidate all tickets belonging to this order
    const tickets = await this.ticketRepository.find({
      where: { orderId },
    });

    for (const ticket of tickets) {
      ticket.seedVersion += 1;
    }

    const { actorId, actorRole } = this.extractActor(adminUser);

    await this.dataSource.transaction(async (manager) => {
      await manager.save(Order, order);
      if (tickets.length > 0) {
        await manager.save(Ticket, tickets);
      }
      await this.auditService.recordLog({
        actorId,
        actorRole,
        action: "ORDER_FLAGGED",
        entityType: "Order",
        entityId: orderId,
        summary:
          reason ||
          `Order ${orderId} flagged as fraudulent. Incremented seedVersion on ${tickets.length} ticket(s) to invalidate signatures.`,
        beforeState: { status: previousStatus },
        afterState: {
          status: OrderStatus.FLAGGED,
          invalidatedTicketsCount: tickets.length,
        },
        ipAddress: ipAddress || null,
      });
    });

    this.logger.warn(
      `Order ${orderId} flagged as fraudulent by ${actorId}. ${tickets.length} ticket QR keys invalidated.`,
    );

    return {
      success: true,
      orderId,
      status: OrderStatus.FLAGGED,
      invalidatedTicketsCount: tickets.length,
    };
  }

  /**
   * Revokes a ticket:
   * 1. Sets ticket.status = 'REVOKED' and increments ticket.seedVersion += 1
   * 2. Sets corresponding EventSeat.status = 'AVAILABLE' in PostgreSQL
   * 3. Calls RedisScriptsWrapper.unsellSeats(eventId, [seatId]) to remove the seat from Redis sold set
   * 4. Publishes { eventId, seatId, state: 'AVAILABLE' } to Redis Pub/Sub channels
   * 5. Writes an audit log recording the revocation
   */
  async revokeTicket(
    ticketId: string,
    adminUser: AdminActor,
    reason?: string,
    ipAddress?: string,
  ): Promise<RevokeTicketResponse> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: ["eventSeat"],
    });

    if (!ticket) {
      throw new NotFoundException({
        code: ErrorCode.TICKET_NOT_FOUND,
        message: `Ticket ${ticketId} not found`,
      });
    }

    if (ticket.status === TicketStatus.REVOKED) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Ticket ${ticketId} is already revoked`,
      });
    }

    const previousStatus = ticket.status;
    const previousSeedVersion = ticket.seedVersion;

    // 1. Mark ticket as REVOKED and rotate seedVersion
    ticket.status = TicketStatus.REVOKED;
    ticket.seedVersion += 1;

    // 2. Identify seat and mark EventSeat AVAILABLE in Postgres
    let seatIdStr = "";
    let seatEntity: EventSeat | null = null;
    if (ticket.eventSeat) {
      ticket.eventSeat.status = SeatState.AVAILABLE;
      seatEntity = ticket.eventSeat;
      seatIdStr = ticket.eventSeat.seatId;
    } else if (ticket.eventSeatId) {
      const seat = await this.eventSeatRepository.findOne({
        where: { id: ticket.eventSeatId },
      });
      if (seat) {
        seat.status = SeatState.AVAILABLE;
        seatEntity = seat;
        seatIdStr = seat.seatId;
      }
    }

    const { actorId, actorRole } = this.extractActor(adminUser);

    await this.dataSource.transaction(async (manager) => {
      await manager.save(Ticket, ticket);
      if (seatEntity) {
        await manager.save(EventSeat, seatEntity);
      }
      await this.auditService.recordLog({
        actorId,
        actorRole,
        action: "TICKET_REVOKED",
        entityType: "Ticket",
        entityId: ticketId,
        summary:
          reason ||
          `Ticket ${ticketId} revoked. Seat ${seatIdStr} marked AVAILABLE and removed from sold set.`,
        beforeState: {
          status: previousStatus,
          seedVersion: previousSeedVersion,
        },
        afterState: {
          status: TicketStatus.REVOKED,
          seedVersion: ticket.seedVersion,
          seatId: seatIdStr,
        },
        ipAddress: ipAddress || null,
      });
    });

    // 3. Remove seat from Redis sold set (seat_sold:{eventId})
    if (seatIdStr && ticket.eventId) {
      try {
        await this.redisScriptsWrapper.unsellSeats(ticket.eventId, [seatIdStr]);
      } catch (err) {
        this.logger.warn(
          `Redis unsellSeats call for seat ${seatIdStr} on event ${ticket.eventId} encountered warning: ${err}`,
        );
      }

      // 4. Publish AVAILABLE update to Redis Pub/Sub channels
      const eventPayload = JSON.stringify({
        eventId: ticket.eventId,
        seatId: seatIdStr,
        state: SeatState.AVAILABLE,
      });

      try {
        await this.redisClient.publish(
          `seat-updates:${ticket.eventId}`,
          eventPayload,
        );
        await this.redisClient.publish("seat.state", eventPayload);
      } catch (err) {
        this.logger.warn(`Redis Pub/Sub broadcast encountered warning: ${err}`);
      }
    }

    return {
      success: true,
      ticketId,
      status: TicketStatus.REVOKED,
      seatId: seatIdStr,
      eventId: ticket.eventId,
    };
  }

  /**
   * Approves an organizer account and ensures an organizer tenant UUID is assigned.
   */
  async approveOrganizer(
    userId: string,
    adminUser: AdminActor,
    reason?: string,
    ipAddress?: string,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `User ${userId} not found`,
      });
    }

    const previousRole = user.role;
    user.role = UserRole.ORGANIZER;
    if (!user.organizerTenantId) {
      user.organizerTenantId = randomUUID();
    }

    await this.userRepository.save(user);

    const { actorId, actorRole } = this.extractActor(adminUser);
    await this.auditService.recordLog({
      actorId,
      actorRole,
      action: "ORGANIZER_APPROVED",
      entityType: "User",
      entityId: userId,
      summary:
        reason ||
        `User ${userId} (${user.email}) approved as Organizer with tenantId ${user.organizerTenantId}`,
      beforeState: { role: previousRole },
      afterState: {
        role: UserRole.ORGANIZER,
        organizerTenantId: user.organizerTenantId,
      },
      ipAddress: ipAddress || null,
    });

    return {
      success: true,
      userId: user.id,
      email: user.email,
      role: user.role,
      organizerTenantId: user.organizerTenantId,
    };
  }

  /**
   * Suspends a user account and immediately revokes all of their active refresh tokens.
   */
  async suspendUser(
    userId: string,
    adminUser: AdminActor,
    reason?: string,
    ipAddress?: string,
  ) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `User ${userId} not found`,
      });
    }

    user.isSuspended = true;
    await this.userRepository.save(user);

    // Revoke all active refresh tokens for the suspended user
    await this.refreshTokenRepository.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );

    const { actorId, actorRole } = this.extractActor(adminUser);
    await this.auditService.recordLog({
      actorId,
      actorRole,
      action: "USER_SUSPENDED",
      entityType: "User",
      entityId: userId,
      summary:
        reason ||
        `User ${userId} (${user.email}) suspended by admin. Active login refresh tokens revoked.`,
      beforeState: { role: user.role },
      afterState: { suspended: true },
      ipAddress: ipAddress || null,
    });

    return {
      success: true,
      userId: user.id,
      email: user.email,
      suspended: true,
    };
  }

  /**
   * Reads global commission rate.
   */
  async getCommissionSettings(): Promise<CommissionSettingsResponse> {
    const rate = await this.platformSettingsService.getCommissionRate();
    return {
      key: "commission_rate_percent",
      commissionRatePercent: rate,
      value: rate.toString(),
    };
  }

  /**
   * Updates global commission rate (0 to 50 percent).
   */
  async updateCommissionRate(
    rateInput: number | string,
    adminUser: AdminActor,
    ipAddress?: string,
  ): Promise<CommissionSettingsResponse> {
    const rate = Number(rateInput);
    if (isNaN(rate) || rate < 0 || rate > 50) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message:
          "Commission rate percent must be an integer or float between 0 and 50",
      });
    }

    const previousRate = await this.platformSettingsService.getCommissionRate();
    await this.platformSettingsService.setCommissionRate(rate);

    const { actorId, actorRole } = this.extractActor(adminUser);
    await this.auditService.recordLog({
      actorId,
      actorRole,
      action: "COMMISSION_RATE_UPDATED",
      entityType: "PlatformSetting",
      entityId: "commission_rate_percent",
      summary: `Global commission rate percent updated from ${previousRate}% to ${rate}%`,
      beforeState: { commissionRatePercent: previousRate },
      afterState: { commissionRatePercent: rate },
      ipAddress: ipAddress || null,
    });

    return {
      key: "commission_rate_percent",
      commissionRatePercent: rate,
      value: rate.toString(),
    };
  }

  /**
   * Fetches paginated and filterable audit logs.
   */
  async getAuditLogs(query: AuditLogQuery): Promise<PaginatedAuditLogs> {
    return this.auditService.getLogs(query);
  }
}
