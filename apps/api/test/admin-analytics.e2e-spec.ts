import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import cookieParser from "cookie-parser";
import { AppModule } from "../src/app.module";
import { GlobalHttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import { loadEnv } from "@urticketbuddy/config";
import {
  TicketStatus,
  SeatState,
  UserRole,
  OrderStatus,
  ErrorCode,
} from "@urticketbuddy/contracts";
import {
  DATA_SOURCE,
  MONGO_CONNECTION,
  VENUE_REPOSITORY,
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  ORDER_REPOSITORY,
  ORDER_ITEM_REPOSITORY,
  TICKET_REPOSITORY,
  GATE_SCAN_REPOSITORY,
  USER_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  PLATFORM_SETTING_REPOSITORY,
  AUDIT_LOG_REPOSITORY,
  REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
} from "../src/database/database.tokens";
import { PlatformSettingsService } from "../src/modules/admin/platform-settings.service";

jest.setTimeout(30000);

describe("Admin Suite & Organizer Analytics API (e2e - Supertest)", () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let platformSettingsService: PlatformSettingsService;

  const env = loadEnv();
  const adminId = "a0000000-0000-0000-0000-000000000001";
  const organizer1Id = "10000000-0000-0000-0000-000000000001";
  const organizer2Id = "20000000-0000-0000-0000-000000000002";
  const customerId = "30000000-0000-0000-0000-000000000001";

  const event1Id = "40000000-0000-0000-0000-000000000001";
  const event2Id = "50000000-0000-0000-0000-000000000002";
  const order1Id = "60000000-0000-0000-0000-000000000001";
  const ticket1Id = "70000000-0000-0000-0000-000000000001";
  const seat1Id = "80000000-0000-0000-0000-000000000001";

  let adminToken: string;
  let organizer1Token: string;
  let organizer2Token: string;
  let customerToken: string;

  // In-memory test state
  const ordersStore = new Map<string, any>();
  const ticketsStore = new Map<string, any>();
  const seatsStore = new Map<string, any>();
  const eventsStore = new Map<string, any>();
  const usersStore = new Map<string, any>();
  const auditLogsStore: any[] = [];
  const platformSettingsStore = new Map<string, any>();
  const gateScansStore: any[] = [];

  const mockRedisClient = {
    publish: jest.fn().mockResolvedValue(1),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
  };

  const mockRedisScriptsWrapper = {
    unsellSeats: jest.fn().mockResolvedValue({ success: true, ok: true }),
    getCounts: jest.fn().mockResolvedValue({ held: 5, sold: 45 }),
  };

  const mockOrderRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const o = ordersStore.get(where.id);
      return o ? { ...o } : null;
    }),
    find: jest.fn(async ({ where }: any) => {
      const results: any[] = [];
      for (const o of ordersStore.values()) {
        if (!where?.eventId || o.eventId === where.eventId) {
          results.push({ ...o });
        }
      }
      return results;
    }),
    save: jest.fn(async (order: any) => {
      ordersStore.set(order.id, { ...order });
      return { ...ordersStore.get(order.id) };
    }),
  };

  const mockTicketRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const t = ticketsStore.get(where.id);
      if (!t) return null;
      const copy = { ...t };
      if (t.eventSeatId && seatsStore.has(t.eventSeatId)) {
        copy.eventSeat = { ...seatsStore.get(t.eventSeatId) };
      }
      return copy;
    }),
    find: jest.fn(async ({ where }: any) => {
      const results: any[] = [];
      for (const t of ticketsStore.values()) {
        if (where?.orderId && t.orderId !== where.orderId) continue;
        if (where?.eventId && t.eventId !== where.eventId) continue;
        results.push({ ...t });
      }
      return results;
    }),
    count: jest.fn(async ({ where }: any) => {
      let count = 0;
      for (const t of ticketsStore.values()) {
        if (where?.eventId && t.eventId !== where.eventId) continue;
        count++;
      }
      return count;
    }),
    save: jest.fn(async (ticketOrTickets: any) => {
      if (Array.isArray(ticketOrTickets)) {
        ticketOrTickets.forEach((t) => ticketsStore.set(t.id, { ...t }));
        return ticketOrTickets;
      }
      ticketsStore.set(ticketOrTickets.id, { ...ticketOrTickets });
      return { ...ticketsStore.get(ticketOrTickets.id) };
    }),
  };

  const mockEventSeatRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const s = seatsStore.get(where.id);
      return s ? { ...s } : null;
    }),
    count: jest.fn(async ({ where }: any) => {
      let count = 0;
      for (const s of seatsStore.values()) {
        if (where?.eventId && s.eventId !== where.eventId) continue;
        count++;
      }
      return count;
    }),
    save: jest.fn(async (seat: any) => {
      seatsStore.set(seat.id, { ...seat });
      return { ...seatsStore.get(seat.id) };
    }),
  };

  const mockEventRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const e = eventsStore.get(where.id);
      return e ? { ...e } : null;
    }),
  };

  const mockUserRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const u = usersStore.get(where.id);
      return u ? { ...u } : null;
    }),
    save: jest.fn(async (user: any) => {
      usersStore.set(user.id, { ...user });
      return { ...usersStore.get(user.id) };
    }),
  };

  const mockRefreshTokenRepo = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockPlatformSettingRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const s = platformSettingsStore.get(where.key);
      return s ? { ...s } : null;
    }),
    create: jest.fn((dto) => ({ id: `setting-${Date.now()}`, ...dto })),
    save: jest.fn(async (setting: any) => {
      platformSettingsStore.set(setting.key, { ...setting });
      return { ...platformSettingsStore.get(setting.key) };
    }),
  };

  const mockAuditLogRepo = {
    create: jest.fn((dto) => ({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date(),
      ...dto,
    })),
    save: jest.fn(async (log: any) => {
      auditLogsStore.push(log);
      return log;
    }),
    findAndCount: jest.fn(async ({ where, skip, take }: any) => {
      let filtered = [...auditLogsStore];
      if (where?.actorId) {
        filtered = filtered.filter((l) => l.actorId === where.actorId);
      }
      if (where?.action) {
        filtered = filtered.filter((l) => l.action === where.action);
      }
      const total = filtered.length;
      const items = filtered.slice(skip || 0, (skip || 0) + (take || 20));
      return [items, total];
    }),
  };

  const mockGateScanRepo = {
    find: jest.fn(async ({ where }: any) => {
      return gateScansStore.filter(
        (g) =>
          (!where?.eventId || g.eventId === where.eventId) &&
          (!where?.result || g.result === where.result),
      );
    }),
  };

  beforeAll(async () => {
    jwtService = new JwtService({ secret: env.JWT_SECRET });

    adminToken = jwtService.sign({
      sub: adminId,
      id: adminId,
      email: "admin@urticketbuddy.local",
      role: UserRole.ADMIN,
    });

    organizer1Token = jwtService.sign({
      sub: organizer1Id,
      id: organizer1Id,
      email: "org1@urticketbuddy.local",
      role: UserRole.ORGANIZER,
      organizerTenantId: organizer1Id,
    });

    organizer2Token = jwtService.sign({
      sub: organizer2Id,
      id: organizer2Id,
      email: "org2@urticketbuddy.local",
      role: UserRole.ORGANIZER,
      organizerTenantId: organizer2Id,
    });

    customerToken = jwtService.sign({
      sub: customerId,
      id: customerId,
      email: "customer@example.com",
      role: UserRole.CUSTOMER,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATA_SOURCE)
      .useValue({
        isInitialized: true,
        destroy: jest.fn(),
        getRepository: jest.fn(() => ({
          create: jest.fn((dto: any) => dto),
          save: jest.fn(async (entity: any) => entity),
          findOne: jest.fn(),
          find: jest.fn(),
          delete: jest.fn(),
          update: jest.fn(),
        })),
        transaction: jest.fn(async (cb: (mgr: any) => Promise<any>) =>
          cb({
            create: jest.fn((_, dto: any) => dto),
            save: jest.fn(async (_, entity: any) => {
              if (Array.isArray(entity)) {
                entity.forEach((e) => {
                  if (e.orderId) ticketsStore.set(e.id, { ...e });
                });
                return entity;
              }
              if (entity) {
                if (entity.seatId !== undefined) {
                  seatsStore.set(entity.id, { ...entity });
                } else if (
                  entity.orderId !== undefined ||
                  entity.seedVersion !== undefined
                ) {
                  ticketsStore.set(entity.id, { ...entity });
                } else if (entity.totalAmount !== undefined) {
                  ordersStore.set(entity.id, { ...entity });
                }
              }
              return entity;
            }),
            update: jest.fn(async () => ({ affected: 1 })),
          }),
        ),
      })
      .overrideProvider(MONGO_CONNECTION)
      .useValue({ readyState: 1 })
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedisClient)
      .overrideProvider(REDIS_SCRIPTS_WRAPPER)
      .useValue(mockRedisScriptsWrapper)
      .overrideProvider(ORDER_REPOSITORY)
      .useValue(mockOrderRepo)
      .overrideProvider(TICKET_REPOSITORY)
      .useValue(mockTicketRepo)
      .overrideProvider(EVENT_SEAT_REPOSITORY)
      .useValue(mockEventSeatRepo)
      .overrideProvider(EVENT_REPOSITORY)
      .useValue(mockEventRepo)
      .overrideProvider(USER_REPOSITORY)
      .useValue(mockUserRepo)
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue(mockRefreshTokenRepo)
      .overrideProvider(PLATFORM_SETTING_REPOSITORY)
      .useValue(mockPlatformSettingRepo)
      .overrideProvider(AUDIT_LOG_REPOSITORY)
      .useValue(mockAuditLogRepo)
      .overrideProvider(GATE_SCAN_REPOSITORY)
      .useValue(mockGateScanRepo)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.use(cookieParser());
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();

    platformSettingsService = moduleFixture.get<PlatformSettingsService>(
      PlatformSettingsService,
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    ordersStore.clear();
    ticketsStore.clear();
    seatsStore.clear();
    eventsStore.clear();
    usersStore.clear();
    auditLogsStore.length = 0;
    platformSettingsStore.clear();
    gateScansStore.length = 0;

    // Seed default commission setting
    platformSettingsStore.set("commission_rate_percent", {
      id: "setting-1",
      key: "commission_rate_percent",
      value: "10",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed test entities
    eventsStore.set(event1Id, {
      id: event1Id,
      name: "Organizer 1 Live Concert",
      organizerId: organizer1Id,
    });

    eventsStore.set(event2Id, {
      id: event2Id,
      name: "Organizer 2 Festival",
      organizerId: organizer2Id,
    });

    seatsStore.set(seat1Id, {
      id: seat1Id,
      eventId: event1Id,
      seatId: "A-1-10",
      status: SeatState.SOLD,
    });

    ticketsStore.set(ticket1Id, {
      id: ticket1Id,
      eventId: event1Id,
      eventSeatId: seat1Id,
      orderId: order1Id,
      ownerId: customerId,
      status: TicketStatus.ISSUED,
      seedVersion: 1,
      faceValueMinor: 500000,
    });

    ordersStore.set(order1Id, {
      id: order1Id,
      eventId: event1Id,
      userId: customerId,
      totalAmount: 5000,
      status: OrderStatus.COMPLETED,
    });
  });

  /**
   * Assertion 1: Ticket revocation (DELETE /api/v1/admin/tickets/:id) marks ticket REVOKED,
   * invokes unsellSeats in Redis, publishes AVAILABLE to Pub/Sub, and creates an AuditLog entry.
   */
  it("Assertion 1: Ticket revocation sets REVOKED, calls unsellSeats, publishes AVAILABLE, and records audit log", async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/admin/tickets/${ticket1Id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Chargeback reported by credit card processor" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe(TicketStatus.REVOKED);
    expect(res.body.seatId).toBe("A-1-10");

    // Verify ticket in store is REVOKED and seedVersion incremented
    const ticketInStore = ticketsStore.get(ticket1Id);
    expect(ticketInStore.status).toBe(TicketStatus.REVOKED);
    expect(ticketInStore.seedVersion).toBe(2);

    // Verify seat in Postgres marked AVAILABLE
    const seatInStore = seatsStore.get(seat1Id);
    expect(seatInStore.status).toBe(SeatState.AVAILABLE);

    // Verify Redis unsellSeats invoked
    expect(mockRedisScriptsWrapper.unsellSeats).toHaveBeenCalledWith(event1Id, [
      "A-1-10",
    ]);

    // Verify Pub/Sub published AVAILABLE
    expect(mockRedisClient.publish).toHaveBeenCalledWith(
      `seat-updates:${event1Id}`,
      expect.stringContaining(SeatState.AVAILABLE),
    );
    expect(mockRedisClient.publish).toHaveBeenCalledWith(
      "seat.state",
      expect.stringContaining(SeatState.AVAILABLE),
    );

    // Verify AuditLog entry created
    const revocationAudit = auditLogsStore.find(
      (l) => l.action === "TICKET_REVOKED" && l.entityId === ticket1Id,
    );
    expect(revocationAudit).toBeDefined();
    expect(revocationAudit.actorId).toBe(adminId);
    expect(revocationAudit.summary).toContain("Chargeback");

    // Verify duplicate revocation attempt returns 400 Bad Request
    const duplicateRevokeRes = await request(app.getHttpServer())
      .delete(`/api/v1/admin/tickets/${ticket1Id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Repeat attempt" });

    expect(duplicateRevokeRes.status).toBe(400);
  });

  /**
   * Assertion 2: Flagging an order increments seedVersion on all of its tickets.
   */
  it("Assertion 2: Flagging an order marks order FLAGGED and increments seedVersion on its tickets", async () => {
    // Add second ticket to order1
    const ticket2Id = "22000000-0000-0000-0000-000000000002";
    ticketsStore.set(ticket2Id, {
      id: ticket2Id,
      eventId: event1Id,
      eventSeatId: seat1Id,
      orderId: order1Id,
      ownerId: customerId,
      status: TicketStatus.ISSUED,
      seedVersion: 3,
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/orders/${order1Id}/flag`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "Stolen payment credential confirmed" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe(OrderStatus.FLAGGED);
    expect(res.body.invalidatedTicketsCount).toBe(2);

    // Verify order status
    expect(ordersStore.get(order1Id).status).toBe(OrderStatus.FLAGGED);

    // Verify both tickets seedVersions incremented
    expect(ticketsStore.get(ticket1Id).seedVersion).toBe(2);
    expect(ticketsStore.get(ticket2Id).seedVersion).toBe(4);

    // Verify AuditLog entry recorded
    const flagAudit = auditLogsStore.find(
      (l) => l.action === "ORDER_FLAGGED" && l.entityId === order1Id,
    );
    expect(flagAudit).toBeDefined();
    expect(flagAudit.actorRole).toBe(UserRole.ADMIN);
  });

  /**
   * Assertion 3: AuditLog entries are append-only and GET /api/v1/admin/audit-logs returns paginated results.
   */
  it("Assertion 3: AuditLog entries are recorded and GET /api/v1/admin/audit-logs returns paginated results", async () => {
    // Populate several audit entries
    auditLogsStore.push(
      {
        id: "audit-1",
        actorId: adminId,
        actorRole: "ADMIN",
        action: "TEST_ACTION_1",
        entityType: "Ticket",
        entityId: "t1",
        createdAt: new Date(),
      },
      {
        id: "audit-2",
        actorId: adminId,
        actorRole: "ADMIN",
        action: "TEST_ACTION_2",
        entityType: "Order",
        entityId: "o1",
        createdAt: new Date(),
      },
    );

    const res = await request(app.getHttpServer())
      .get("/api/v1/admin/audit-logs?page=1&pageSize=10")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("items");
    expect(res.body).toHaveProperty("total");
    expect(res.body).toHaveProperty("page", 1);
    expect(res.body).toHaveProperty("pageSize", 10);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);

    // Verify non-admins cannot read audit logs
    const nonAdminRes = await request(app.getHttpServer())
      .get("/api/v1/admin/audit-logs")
      .set("Authorization", `Bearer ${customerToken}`);

    expect(nonAdminRes.status).toBe(403);
  });

  /**
   * Assertion 4: An ORGANIZER can fetch analytics for their own event (200 OK)
   * but receives 403 Forbidden when querying another organizer's event.
   */
  it("Assertion 4: ORGANIZER receives 200 for owned event, and 403 Forbidden for another organizer's event", async () => {
    // 1. Organizer 1 querying event 1 (owned by Organizer 1) -> 200 OK
    const ownRes = await request(app.getHttpServer())
      .get(`/api/v1/organizer/analytics/${event1Id}`)
      .set("Authorization", `Bearer ${organizer1Token}`);

    expect(ownRes.status).toBe(200);
    expect(ownRes.body.eventId).toBe(event1Id);
    expect(ownRes.body).toHaveProperty("totalRevenue");
    expect(ownRes.body).toHaveProperty("ticketsSold");
    expect(ownRes.body).toHaveProperty("totalCapacity");
    expect(ownRes.body).toHaveProperty("occupancyRate");
    expect(ownRes.body).toHaveProperty("entryVelocity");
    expect(ownRes.body).toHaveProperty("holdStats");
    expect(ownRes.body).toHaveProperty("resaleStats");

    // 2. Organizer 1 querying event 2 (owned by Organizer 2) -> 403 Forbidden
    const forbiddenRes = await request(app.getHttpServer())
      .get(`/api/v1/organizer/analytics/${event2Id}`)
      .set("Authorization", `Bearer ${organizer1Token}`);

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.code).toBe(ErrorCode.FORBIDDEN);

    // 3. Admin querying event 2 -> 200 OK (Admin bypasses tenant restriction)
    const adminRes = await request(app.getHttpServer())
      .get(`/api/v1/organizer/analytics/${event2Id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(adminRes.status).toBe(200);
    expect(adminRes.body.eventId).toBe(event2Id);
  });

  /**
   * Assertion 5: Updating commission rate via PUT /api/v1/admin/settings/commission updates PlatformSettingsPort.
   */
  it("Assertion 5: Updating commission rate via PUT /api/v1/admin/settings/commission updates PlatformSettingsPort", async () => {
    const putRes = await request(app.getHttpServer())
      .put("/api/v1/admin/settings/commission")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ commissionRatePercent: 18 });

    expect(putRes.status).toBe(200);
    expect(putRes.body.commissionRatePercent).toBe(18);

    // Verify PlatformSettingsPort reflects the updated rate
    const currentRateFromPort =
      await platformSettingsService.getCommissionRate();
    expect(currentRateFromPort).toBe(18);

    const settingValue = await platformSettingsService.getSetting(
      "commission_rate_percent",
    );
    expect(Number(settingValue)).toBe(18);

    // Verify AuditLog entry for commission update
    const commissionAudit = auditLogsStore.find(
      (l) =>
        l.action === "COMMISSION_RATE_UPDATED" &&
        l.entityId === "commission_rate_percent",
    );
    expect(commissionAudit).toBeDefined();
    expect(commissionAudit.afterState).toEqual({ commissionRatePercent: 18 });

    // Verify out-of-range commission rate returns 400 Bad Request (not 500)
    const invalidRateRes = await request(app.getHttpServer())
      .put("/api/v1/admin/settings/commission")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ commissionRatePercent: 55 });

    expect(invalidRateRes.status).toBe(400);
    expect(invalidRateRes.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });
});
