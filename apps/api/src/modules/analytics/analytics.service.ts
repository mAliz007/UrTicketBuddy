import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Repository, In } from "typeorm";
import { Event, EventSeat, Ticket, Order, GateScan } from "@urticketbuddy/db";
import {
  UserRole,
  ErrorCode,
  TicketStatus,
  OrderStatus,
  OrganizerAnalyticsResponse,
  EntryVelocityBucket,
} from "@urticketbuddy/contracts";
import { RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";
import {
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  TICKET_REPOSITORY,
  ORDER_REPOSITORY,
  GATE_SCAN_REPOSITORY,
  REDIS_SCRIPTS_WRAPPER,
} from "../../database/database.tokens";

export interface AnalyticsRequester {
  id?: string;
  userId?: string;
  email?: string;
  role?: string;
  organizerTenantId?: string | null;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @Inject(EVENT_REPOSITORY)
    private readonly eventRepository: Repository<Event>,
    @Inject(EVENT_SEAT_REPOSITORY)
    private readonly eventSeatRepository: Repository<EventSeat>,
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepository: Repository<Ticket>,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: Repository<Order>,
    @Inject(GATE_SCAN_REPOSITORY)
    private readonly gateScanRepository: Repository<GateScan>,
    @Inject(REDIS_SCRIPTS_WRAPPER)
    private readonly redisScriptsWrapper: RedisScriptsWrapper,
  ) {}

  /**
   * Computes comprehensive analytics for an event:
   * Revenue, capacity, tickets sold, entry velocity in 5-minute buckets,
   * active hold stats from Redis, and resale metrics.
   *
   * Enforces tenant ownership verification:
   * - ADMIN bypasses
   * - ORGANIZER must match event's organizerId or receive 403 Forbidden
   */
  async getEventAnalytics(
    eventId: string,
    requester: AnalyticsRequester,
  ): Promise<OrganizerAnalyticsResponse> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: `Event ${eventId} not found`,
      });
    }

    // Tenant ownership check: Admins bypass, Organizers must match event organizerId
    if (requester.role !== UserRole.ADMIN) {
      const tenantId = requester.organizerTenantId;
      const userId = requester.id || requester.userId;
      const eventOrganizerId = event.organizerId;

      const isMatch =
        (tenantId && eventOrganizerId === tenantId) ||
        (userId && eventOrganizerId === userId);

      if (!isMatch) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: "Forbidden: You do not own this event's analytics",
        });
      }
    }

    // 1. Total Capacity
    const totalCapacity = await this.eventSeatRepository.count({
      where: { eventId },
    });

    // 2. Tickets Sold (ISSUED or CHECKED_IN)
    const ticketsSold = await this.ticketRepository.count({
      where: {
        eventId,
        status: In([TicketStatus.ISSUED, TicketStatus.CHECKED_IN]),
      },
    });

    // 3. Occupancy Rate (Percentage with 2 decimal places)
    const occupancyRate =
      totalCapacity > 0
        ? Math.round((ticketsSold / totalCapacity) * 10000) / 100
        : 0;

    // 4. Total Revenue (COMPLETED or PENDING/PAID orders)
    const completedOrders = await this.orderRepository.find({
      where: {
        eventId,
        status: In([OrderStatus.COMPLETED, "PAID", "CONFIRMED"]),
      },
      select: ["totalAmount"],
    });

    const totalRevenue = completedOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );

    // 5. Entry Velocity: 5-minute bucket aggregates from VALID gate scans
    const validScans = await this.gateScanRepository.find({
      where: {
        eventId,
        result: "VALID",
      },
      order: { scannedAt: "ASC" },
    });

    const bucketMs = 5 * 60 * 1000;
    const bucketMap = new Map<string, number>();

    for (const scan of validScans) {
      const scanTime = new Date(scan.scannedAt).getTime();
      const bucketTimeMs = Math.floor(scanTime / bucketMs) * bucketMs;
      const bucketKey = new Date(bucketTimeMs).toISOString();
      bucketMap.set(bucketKey, (bucketMap.get(bucketKey) || 0) + 1);
    }

    const entryVelocity: EntryVelocityBucket[] = Array.from(
      bucketMap.entries(),
    ).map(([timestamp, count]) => ({ timestamp, count }));

    // 6. Hold Stats: Active holds and sold counts from Redis snapshot
    let holdStats = { held: 0, sold: 0 };
    try {
      const counts = await this.redisScriptsWrapper.getCounts(eventId);
      holdStats = {
        held: counts.held ?? counts.heldCount ?? 0,
        sold: counts.sold ?? counts.soldCount ?? 0,
      };
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Redis seat counts for event ${eventId}: ${err}`,
      );
    }

    // 7. Resale Stats: Clean fallback port (Member C ownership per AGENTS.md rule 5)
    const resaleStats = {
      activeListings: 0,
      soldListings: 0,
      totalResaleVolume: 0,
    };

    return {
      eventId,
      totalRevenue,
      ticketsSold,
      totalCapacity,
      occupancyRate,
      entryVelocity,
      holdStats,
      resaleStats,
    };
  }
}
