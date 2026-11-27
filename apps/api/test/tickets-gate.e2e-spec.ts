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
  ScanResult,
  UserRole,
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
  REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
} from "../src/database/database.tokens";
import { BloomService } from "../src/common/bloom/bloom.service";
import { TicketsService } from "../src/modules/tickets/tickets.service";

jest.setTimeout(30000);

describe("Dynamic QR Tickets & Gate Scanner API (e2e - Supertest)", () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let ticketsService: TicketsService;

  const env = loadEnv();
  const eventId = "e1000000-0000-0000-0000-000000000001";
  const ownerId = "u1000000-0000-0000-0000-000000000001";
  const intruderId = "u2000000-0000-0000-0000-000000000002";
  const gateStaffId = "u3000000-0000-0000-0000-000000000003";
  const adminId = "u4000000-0000-0000-0000-000000000004";

  let ownerToken: string;
  let intruderToken: string;
  let gateStaffToken: string;
  let otherGateStaffToken: string;
  let adminToken: string;

  const sampleTicket = {
    id: "a1000000-0000-0000-0000-000000000001",
    eventId,
    eventSeatId: "c1000000-0000-0000-0000-000000000001",
    orderId: "d1000000-0000-0000-0000-000000000001",
    ownerId,
    status: TicketStatus.ISSUED,
    seedVersion: 1,
    faceValueMinor: 100000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // In-memory test stores
  const ticketsStore = new Map<string, any>();
  const gateScansStore: any[] = [];
  const redisNonces = new Set<string>();

  const mockTicketRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const ticket = ticketsStore.get(where.id);
      return ticket ? { ...ticket } : null;
    }),
    find: jest.fn(async ({ where }: any) => {
      const results: any[] = [];
      for (const t of ticketsStore.values()) {
        if (
          !where ||
          where.ownerId === undefined ||
          t.ownerId === where.ownerId
        ) {
          results.push({ ...t });
        }
      }
      return results;
    }),
    save: jest.fn(async (ticket: any) => {
      ticketsStore.set(ticket.id, { ...ticket, updatedAt: new Date() });
      return { ...ticketsStore.get(ticket.id) };
    }),
    update: jest.fn(async (criteria: any, partial: any) => {
      const existing = ticketsStore.get(criteria.id);
      if (existing) {
        if (criteria.status && existing.status !== criteria.status) {
          return { affected: 0 };
        }
        if (
          criteria.seedVersion !== undefined &&
          existing.seedVersion !== criteria.seedVersion
        ) {
          return { affected: 0 };
        }
        Object.assign(existing, partial, { updatedAt: new Date() });
        return { affected: 1 };
      }
      return { affected: 0 };
    }),
    increment: jest.fn(async (criteria: any, field: string, amount: number) => {
      const existing = ticketsStore.get(criteria.id);
      if (existing) {
        existing[field] = (existing[field] || 0) + amount;
      }
    }),
  };

  const mockGateScanRepo = {
    create: jest.fn((dto: any) => ({
      id: `scan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      scannedAt: new Date(),
      ...dto,
    })),
    save: jest.fn(async (scan: any) => {
      gateScansStore.push(scan);
      return scan;
    }),
    count: jest.fn(async ({ where }: any) => {
      return gateScansStore.filter((s) => {
        if (where?.eventId && s.eventId !== where.eventId) return false;
        if (where?.result && s.result !== where.result) return false;
        return true;
      }).length;
    }),
  };

  const mockRedisClient = {
    get: jest.fn(async () => null),
    exists: jest.fn(async () => 1),
    del: jest.fn(async (key: string) => {
      redisNonces.delete(key);
      return 1;
    }),
    set: jest.fn(
      async (
        key: string,
        val: string,
        mode?: string,
        ttl?: number,
        flag?: string,
      ) => {
        if (flag === "NX") {
          if (redisNonces.has(key)) {
            return null;
          }
          redisNonces.add(key);
          return "OK";
        }
        return "OK";
      },
    ),
    call: jest.fn(async (cmd: string, ...args: any[]) => {
      if (cmd === "BF.EXISTS") {
        const ticketId = args[1];
        return ticketsStore.has(ticketId) ? 1 : 0;
      }
      if (cmd === "BF.ADD") {
        return 1;
      }
      return 1;
    }),
    sadd: jest.fn(async () => 1),
    sismember: jest.fn(async (key: string, member: string) => {
      return ticketsStore.has(member) ? 1 : 0;
    }),
  };

  const mockDataSource = {
    isInitialized: true,
    destroy: jest.fn(),
    getRepository: jest.fn(() => ({
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    })),
    transaction: jest.fn(async (cb: (mgr: any) => Promise<any>) =>
      cb(mockTicketRepo),
    ),
  };

  beforeAll(async () => {
    jwtService = new JwtService({ secret: env.JWT_SECRET });

    ownerToken = jwtService.sign({
      sub: ownerId,
      email: "owner@example.com",
      role: UserRole.CUSTOMER,
    });
    intruderToken = jwtService.sign({
      sub: intruderId,
      email: "intruder@example.com",
      role: UserRole.CUSTOMER,
    });
    gateStaffToken = jwtService.sign({
      sub: gateStaffId,
      email: "gatestaff@example.com",
      role: UserRole.GATE_STAFF,
      organizerTenantId: "org-1",
    });
    otherGateStaffToken = jwtService.sign({
      sub: "u5000000-0000-0000-0000-000000000005",
      email: "otherstaff@example.com",
      role: UserRole.GATE_STAFF,
      organizerTenantId: "org-2",
    });
    adminToken = jwtService.sign({
      sub: adminId,
      email: "admin@example.com",
      role: UserRole.ADMIN,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATA_SOURCE)
      .useValue(mockDataSource)
      .overrideProvider(MONGO_CONNECTION)
      .useValue({ readyState: 1 })
      .overrideProvider(VENUE_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(EVENT_REPOSITORY)
      .useValue({
        findOne: jest.fn(async ({ where }: any) => {
          if (where?.id === eventId) {
            return {
              id: eventId,
              organizerId: "org-1",
              title: "Test Event",
            };
          }
          return null;
        }),
        save: jest.fn(),
      })
      .overrideProvider(EVENT_SEAT_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(ORDER_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(ORDER_ITEM_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(USER_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn() })
      .overrideProvider(TICKET_REPOSITORY)
      .useValue(mockTicketRepo)
      .overrideProvider(GATE_SCAN_REPOSITORY)
      .useValue(mockGateScanRepo)
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedisClient)
      .overrideProvider(REDIS_SCRIPTS_WRAPPER)
      .useValue({ getSnapshot: jest.fn(), confirmSold: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();

    ticketsService = moduleFixture.get<TicketsService>(TicketsService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    ticketsStore.clear();
    gateScansStore.length = 0;
    redisNonces.clear();
    jest.clearAllMocks();

    // Seed test ticket
    ticketsStore.set(sampleTicket.id, { ...sampleTicket });
  });

  describe("1. Dynamic QR Code Generation (GET /api/v1/tickets/:ticketId/dynamic-qr)", () => {
    it("should return dynamic QR payload for ticket owner with 30s window", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${sampleTicket.id}/dynamic-qr`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.ticketId).toBe(sampleTicket.id);
      expect(res.body.token).toBeDefined();
      expect(res.body.windowSeconds).toBe(30);
      expect(res.body.expiresAt).toBeDefined();

      // Verify token format: base64url(ticketId.window.hmac)
      const decoded = Buffer.from(res.body.token, "base64url").toString("utf8");
      const parts = decoded.split(".");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe(sampleTicket.id);
    });

    it("should return 403 Forbidden when requested by a non-owner", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${sampleTicket.id}/dynamic-qr`)
        .set("Authorization", `Bearer ${intruderToken}`)
        .expect(403);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });

    it("should allow ADMIN to generate dynamic QR for any ticket", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${sampleTicket.id}/dynamic-qr`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.ticketId).toBe(sampleTicket.id);
      expect(res.body.token).toBeDefined();
    });

    it("should return 400 BadRequest if ticket is already CHECKED_IN", async () => {
      ticketsStore.get(sampleTicket.id).status = TicketStatus.CHECKED_IN;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${sampleTicket.id}/dynamic-qr`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(400);

      expect(res.body.error.code).toBe(ErrorCode.TICKET_ALREADY_USED);
    });
  });

  describe("2. Ticket Wallet API (GET /api/v1/users/me/tickets)", () => {
    it("should return all tickets owned by the authenticated caller", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/users/me/tickets")
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(sampleTicket.id);
      expect(res.body[0].ownerId).toBe(ownerId);
    });
  });

  describe("3. Gate Scanner API (POST /api/v1/gate/scan)", () => {
    it("should successfully scan and check in an ISSUED ticket", async () => {
      // 1. Generate active QR token as owner
      const qrRes = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${sampleTicket.id}/dynamic-qr`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      const qrToken = qrRes.body.token;

      // 2. Scan ticket as gate staff
      const scanRes = await request(app.getHttpServer())
        .post("/api/v1/gate/scan")
        .set("Authorization", `Bearer ${gateStaffToken}`)
        .send({
          token: qrToken,
          eventId,
        })
        .expect(200);

      expect(scanRes.body.result).toBe(ScanResult.VALID);
      expect(scanRes.body.ticketId).toBe(sampleTicket.id);
      expect(scanRes.body.seatId).toBe(sampleTicket.eventSeatId);

      // Verify status transitioned to CHECKED_IN in database
      expect(ticketsStore.get(sampleTicket.id).status).toBe(
        TicketStatus.CHECKED_IN,
      );

      // Verify audit scan was recorded
      expect(gateScansStore.some((s) => s.result === ScanResult.VALID)).toBe(
        true,
      );
    });

    it("should reject double-scan / replay token within 60s with 409 Conflict (USED)", async () => {
      const qrRes = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${sampleTicket.id}/dynamic-qr`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      const qrToken = qrRes.body.token;

      // First scan: successful
      await request(app.getHttpServer())
        .post("/api/v1/gate/scan")
        .set("Authorization", `Bearer ${gateStaffToken}`)
        .send({ token: qrToken, eventId })
        .expect(200);

      // Second scan (replay): must be rejected with 409
      const replayRes = await request(app.getHttpServer())
        .post("/api/v1/gate/scan")
        .set("Authorization", `Bearer ${gateStaffToken}`)
        .send({ token: qrToken, eventId })
        .expect(409);

      expect(replayRes.body.error).toBeDefined();
      expect(replayRes.body.error.code).toBe(ErrorCode.TICKET_ALREADY_USED);

      // Verify audit scan recorded USED
      expect(gateScansStore.some((s) => s.result === ScanResult.USED)).toBe(
        true,
      );
    });

    it("should reject screenshot token with expired window with 400 Bad Request (EXPIRED)", async () => {
      // Generate token with an expired window (> 60 seconds ago)
      const expiredTime = Date.now() - 90 * 1000;
      const { token: expiredToken } = ticketsService.generateDynamicToken(
        sampleTicket.id,
        sampleTicket.seedVersion,
        expiredTime,
      );

      const res = await request(app.getHttpServer())
        .post("/api/v1/gate/scan")
        .set("Authorization", `Bearer ${gateStaffToken}`)
        .send({
          token: expiredToken,
          eventId,
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(ErrorCode.TICKET_EXPIRED);
      expect(gateScansStore.some((s) => s.result === ScanResult.EXPIRED)).toBe(
        true,
      );
    });

    it("should reject forged ticket via BloomService with ZERO PostgreSQL queries", async () => {
      const forgedTicketId = "a9999999-0000-0000-0000-999999999999";
      const forgedToken = Buffer.from(
        `${forgedTicketId}.${Math.floor(Date.now() / 1000 / 30)}.forgedhmac123`,
      ).toString("base64url");

      mockTicketRepo.findOne.mockClear();

      const res = await request(app.getHttpServer())
        .post("/api/v1/gate/scan")
        .set("Authorization", `Bearer ${gateStaffToken}`)
        .send({
          token: forgedToken,
          eventId,
        })
        .expect(400);

      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe(ErrorCode.TICKET_NOT_FOUND);

      // Verify PostgreSQL findOne was NEVER called (O(1) prefilter protection)
      expect(mockTicketRepo.findOne).not.toHaveBeenCalled();

      // Verify scan audit was logged as INVALID with ticketId: null and scannedTicketRef
      expect(
        gateScansStore.some(
          (s) =>
            s.result === ScanResult.INVALID &&
            s.ticketId === null &&
            s.scannedTicketRef === forgedTicketId,
        ),
      ).toBe(true);
    });

    it("should reject gate staff from another organizer tenant over real HTTP with 403 Forbidden", async () => {
      const qrRes = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${sampleTicket.id}/dynamic-qr`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post("/api/v1/gate/scan")
        .set("Authorization", `Bearer ${otherGateStaffToken}`)
        .send({
          token: qrRes.body.token,
          eventId,
        })
        .expect(403);

      expect(res.body.error.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe("4. Seed Rotation (PATCH /api/v1/tickets/:id/rotate-key)", () => {
    it("should forbid non-ADMIN from rotating key", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/tickets/${sampleTicket.id}/rotate-key`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(403);
    });

    it("should allow ADMIN to rotate key and invalidate previously issued QR tokens", async () => {
      // 1. Generate token under seedVersion 1
      const qrRes = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${sampleTicket.id}/dynamic-qr`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      const oldToken = qrRes.body.token;

      // 2. Rotate key as ADMIN
      const rotateRes = await request(app.getHttpServer())
        .patch(`/api/v1/tickets/${sampleTicket.id}/rotate-key`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);

      expect(rotateRes.body.seedVersion).toBe(2);
      expect(ticketsStore.get(sampleTicket.id).seedVersion).toBe(2);

      // 3. Attempting to scan the old token must fail HMAC validation
      const scanRes = await request(app.getHttpServer())
        .post("/api/v1/gate/scan")
        .set("Authorization", `Bearer ${gateStaffToken}`)
        .send({
          token: oldToken,
          eventId,
        })
        .expect(400);

      expect(scanRes.body.error.code).toBe(ErrorCode.TICKET_INVALID);

      // 4. Freshly generated token under seedVersion 2 succeeds
      const freshQrRes = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${sampleTicket.id}/dynamic-qr`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .expect(200);

      const freshScanRes = await request(app.getHttpServer())
        .post("/api/v1/gate/scan")
        .set("Authorization", `Bearer ${gateStaffToken}`)
        .send({
          token: freshQrRes.body.token,
          eventId,
        })
        .expect(200);

      expect(freshScanRes.body.result).toBe(ScanResult.VALID);
    });
  });

  describe("5. Gate Metrics (GET /api/v1/gate/metrics)", () => {
    it("should return scan metrics and entry velocity for event", async () => {
      // Populate some mock scans
      gateScansStore.push(
        { eventId, result: ScanResult.VALID, scannedAt: new Date() },
        { eventId, result: ScanResult.VALID, scannedAt: new Date() },
        { eventId, result: ScanResult.INVALID, scannedAt: new Date() },
      );

      const res = await request(app.getHttpServer())
        .get(`/api/v1/gate/metrics?eventId=${eventId}`)
        .set("Authorization", `Bearer ${gateStaffToken}`)
        .expect(200);

      expect(res.body.eventId).toBe(eventId);
      expect(res.body.totalScans).toBe(3);
      expect(res.body.validScans).toBe(2);
      expect(res.body.rejectedScans).toBe(1);
      expect(res.body.entryVelocityPerMinute).toBeDefined();
    });
  });
});
