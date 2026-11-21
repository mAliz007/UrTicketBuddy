import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { loadEnv } from "@urticketbuddy/config";
import {
  ErrorCode,
  LedgerEntryKind,
  ResaleListingStatus,
  ScanResult,
  TicketStatus,
  UserRole,
} from "@urticketbuddy/contracts";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { BloomService } from "../src/common/bloom/bloom.service";
import { GlobalHttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import {
  DATA_SOURCE,
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  GATE_SCAN_REPOSITORY,
  LEDGER_ENTRY_REPOSITORY,
  MONGO_CONNECTION,
  ORDER_ITEM_REPOSITORY,
  ORDER_REPOSITORY,
  REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
  REFRESH_TOKEN_REPOSITORY,
  RESALE_LISTING_REPOSITORY,
  TICKET_REPOSITORY,
  USER_REPOSITORY,
  VENUE_REPOSITORY,
} from "../src/database/database.tokens";
import { TicketsService } from "../src/modules/tickets/tickets.service";

jest.setTimeout(30000);

describe("Capped P2P Resale Marketplace API (e2e - Supertest)", () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let ticketsService: TicketsService;

  const env = loadEnv();
  const eventId = "e1000000-0000-0000-0000-000000000001";
  const sellerId = "u1000000-0000-0000-0000-000000000001";
  const buyer1Id = "u2000000-0000-0000-0000-000000000002";
  const buyer2Id = "u3000000-0000-0000-0000-000000000003";
  const gateStaffId = "u4000000-0000-0000-0000-000000000004";

  const issuedTicketId = "a1000000-0000-0000-0000-000000000001";
  const checkedInTicketId = "a2000000-0000-0000-0000-000000000002";

  let sellerToken: string;
  let buyer1Token: string;
  let buyer2Token: string;
  let gateStaffToken: string;

  const futureEvent = {
    id: eventId,
    name: "Resale Concert",
    startTime: new Date(Date.now() + 86_400_000),
    status: "PUBLISHED",
  };

  // In-memory stores
  const ticketsStore = new Map<string, Record<string, unknown>>();
  const listingsStore = new Map<string, Record<string, unknown>>();
  const ledgerStore: Array<Record<string, unknown>> = [];
  const gateScansStore: Array<Record<string, unknown>> = [];
  const redisLockStore = new Map<string, string>();
  const redisNonces = new Set<string>();

  const mockTicketRepo = {
    findOne: jest.fn(
      async ({
        where,
        relations,
      }: {
        where: { id: string };
        relations?: string[];
      }) => {
        const ticket = ticketsStore.get(where.id);
        if (!ticket) return null;
        const copy = { ...ticket };
        if (relations?.includes("event")) {
          copy.event = futureEvent;
        }
        return copy;
      },
    ),
    find: jest.fn(async () => Array.from(ticketsStore.values())),
    save: jest.fn(async (ticket: Record<string, unknown>) => {
      const saved = { ...ticket, updatedAt: new Date() };
      ticketsStore.set(String(ticket.id), saved);
      return { ...saved };
    }),
    update: jest.fn(
      async (
        criteria: { id: string; status?: string; seedVersion?: number },
        partial: Record<string, unknown>,
      ) => {
        const existing = ticketsStore.get(criteria.id);
        if (!existing) return { affected: 0 };
        if (criteria.status && existing.status !== criteria.status) {
          return { affected: 0 };
        }
        if (
          criteria.seedVersion !== undefined &&
          existing.seedVersion !== criteria.seedVersion
        ) {
          return { affected: 0 };
        }
        ticketsStore.set(criteria.id, { ...existing, ...partial });
        return { affected: 1 };
      },
    ),
  };

  const mockListingRepo = {
    create: jest.fn((data: Record<string, unknown>) => ({
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    })),
    save: jest.fn(async (listing: Record<string, unknown>) => {
      const saved = { ...listing, updatedAt: new Date() };
      listingsStore.set(String(saved.id), saved);
      return { ...saved };
    }),
    findOne: jest.fn(
      async ({
        where,
      }: {
        where: { id?: string; ticketId?: string; status?: string };
      }) => {
        for (const item of listingsStore.values()) {
          if (where.id && item.id !== where.id) continue;
          if (where.ticketId && item.ticketId !== where.ticketId) continue;
          if (where.status && item.status !== where.status) continue;
          return { ...item };
        }
        return null;
      },
    ),
    findAndCount: jest.fn(
      async ({
        where,
        skip = 0,
        take = 20,
      }: {
        where: { status?: string; eventId?: string };
        skip?: number;
        take?: number;
      }) => {
        const all = Array.from(listingsStore.values()).filter((item) => {
          if (where.status && item.status !== where.status) return false;
          if (where.eventId && item.eventId !== where.eventId) return false;
          return true;
        });
        return [all.slice(skip, skip + take), all.length];
      },
    ),
  };

  const mockLedgerRepo = {
    create: jest.fn((data: Record<string, unknown>) => ({
      id: randomUUID(),
      createdAt: new Date(),
      ...data,
    })),
    save: jest.fn(async (entries: Array<Record<string, unknown>>) => {
      const list = Array.isArray(entries) ? entries : [entries];
      for (const entry of list) {
        ledgerStore.push({ ...entry });
      }
      return list;
    }),
  };

  const mockGateScanRepo = {
    create: jest.fn((data: Record<string, unknown>) => ({
      id: randomUUID(),
      ...data,
    })),
    save: jest.fn(async (scan: Record<string, unknown>) => {
      gateScansStore.push(scan);
      return scan;
    }),
  };

  const mockRedisClient = {
    status: "ready",
    set: jest.fn(
      async (
        key: string,
        val: string,
        _exFlag?: string,
        _ttl?: number,
        nxFlag?: string,
      ) => {
        if (nxFlag === "NX") {
          if (key.startsWith("resale_lock:")) {
            if (redisLockStore.has(key)) return null;
            redisLockStore.set(key, val);
            return "OK";
          }
          if (redisNonces.has(key)) return null;
          redisNonces.add(key);
          return "OK";
        }
        redisLockStore.set(key, val);
        return "OK";
      },
    ),
    get: jest.fn(async (key: string) => redisLockStore.get(key) ?? null),
    del: jest.fn(async (key: string) => {
      redisLockStore.delete(key);
      redisNonces.delete(key);
      return 1;
    }),
    call: jest.fn(async () => 1),
    sadd: jest.fn(async () => 1),
    sismember: jest.fn(async () => 1),
    eval: jest.fn(
      async (_script: string, _numKeys: number, key: string, val: string) => {
        if (redisLockStore.get(key) === val) {
          redisLockStore.delete(key);
          return 1;
        }
        return 0;
      },
    ),
  };

  const mockDataSource = {
    isInitialized: true,
    transaction: jest.fn(
      async (
        cb: (manager: {
          findOne: (
            Entity: { name: string },
            opts: { where: { id: string } },
          ) => Promise<Record<string, unknown> | null>;
          create: (
            Entity: { name: string },
            data: Record<string, unknown>,
          ) => Record<string, unknown>;
          save: (Entity: { name: string }, data: unknown) => Promise<unknown>;
          update: typeof mockTicketRepo.update;
        }) => Promise<unknown>,
      ) => {
        const manager = {
          findOne: async (
            Entity: { name: string },
            opts: { where: { id: string } },
          ) => {
            if (Entity.name === "ResaleListing") {
              return mockListingRepo.findOne({ where: { id: opts.where.id } });
            }
            if (Entity.name === "Ticket") {
              return mockTicketRepo.findOne({ where: { id: opts.where.id } });
            }
            return null;
          },
          create: (Entity: { name: string }, data: Record<string, unknown>) => {
            if (Entity.name === "LedgerEntry") {
              return mockLedgerRepo.create(data);
            }
            return data;
          },
          save: async (Entity: { name: string }, data: unknown) => {
            if (Entity.name === "LedgerEntry") {
              return mockLedgerRepo.save(
                data as Array<Record<string, unknown>>,
              );
            }
            if (Entity.name === "Ticket") {
              return mockTicketRepo.save(data as Record<string, unknown>);
            }
            if (Entity.name === "ResaleListing") {
              return mockListingRepo.save(data as Record<string, unknown>);
            }
            return data;
          },
          update: mockTicketRepo.update,
        };
        return cb(manager);
      },
    ),
  };

  const mockBloomService = {
    mightExist: jest.fn(async () => true),
    addTicket: jest.fn(async () => true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATA_SOURCE)
      .useValue(mockDataSource)
      .overrideProvider(MONGO_CONNECTION)
      .useValue({ readyState: 1 })
      .overrideProvider(VENUE_REPOSITORY)
      .useValue({})
      .overrideProvider(EVENT_REPOSITORY)
      .useValue({ findOne: jest.fn(async () => futureEvent) })
      .overrideProvider(EVENT_SEAT_REPOSITORY)
      .useValue({})
      .overrideProvider(ORDER_REPOSITORY)
      .useValue({})
      .overrideProvider(ORDER_ITEM_REPOSITORY)
      .useValue({})
      .overrideProvider(USER_REPOSITORY)
      .useValue({})
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue({})
      .overrideProvider(TICKET_REPOSITORY)
      .useValue(mockTicketRepo)
      .overrideProvider(GATE_SCAN_REPOSITORY)
      .useValue(mockGateScanRepo)
      .overrideProvider(RESALE_LISTING_REPOSITORY)
      .useValue(mockListingRepo)
      .overrideProvider(LEDGER_ENTRY_REPOSITORY)
      .useValue(mockLedgerRepo)
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedisClient)
      .overrideProvider(REDIS_SCRIPTS_WRAPPER)
      .useValue({})
      .overrideProvider(BloomService)
      .useValue(mockBloomService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.use(cookieParser());
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();

    jwtService = app.get(JwtService);
    ticketsService = app.get(TicketsService);

    sellerToken = jwtService.sign(
      { sub: sellerId, email: "seller@test.com", role: UserRole.CUSTOMER },
      { secret: env.JWT_SECRET },
    );
    buyer1Token = jwtService.sign(
      { sub: buyer1Id, email: "buyer1@test.com", role: UserRole.CUSTOMER },
      { secret: env.JWT_SECRET },
    );
    buyer2Token = jwtService.sign(
      { sub: buyer2Id, email: "buyer2@test.com", role: UserRole.CUSTOMER },
      { secret: env.JWT_SECRET },
    );
    gateStaffToken = jwtService.sign(
      { sub: gateStaffId, email: "gate@test.com", role: UserRole.GATE_STAFF },
      { secret: env.JWT_SECRET },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    ticketsStore.clear();
    listingsStore.clear();
    ledgerStore.length = 0;
    gateScansStore.length = 0;
    redisLockStore.clear();
    redisNonces.clear();

    ticketsStore.set(issuedTicketId, {
      id: issuedTicketId,
      eventId,
      eventSeatId: "c1000000-0000-0000-0000-000000000001",
      orderId: "d1000000-0000-0000-0000-000000000001",
      ownerId: sellerId,
      status: TicketStatus.ISSUED,
      seedVersion: 1,
      faceValueMinor: 10000,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    ticketsStore.set(checkedInTicketId, {
      id: checkedInTicketId,
      eventId,
      eventSeatId: "c2000000-0000-0000-0000-000000000002",
      orderId: "d2000000-0000-0000-0000-000000000002",
      ownerId: sellerId,
      status: TicketStatus.CHECKED_IN,
      seedVersion: 1,
      faceValueMinor: 10000,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it("allows listing at exact 110% cap (201) and rejects 1 minor unit above cap (400)", async () => {
    // 10000 * 110 / 100 = 11000; 11001 exceeds cap
    const overCapRes = await request(app.getHttpServer())
      .post("/api/v1/resale/listings")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ ticketId: issuedTicketId, askingPriceMinor: 11001 })
      .expect(400);

    expect(overCapRes.body.error.code).toBe(
      ErrorCode.RESALE_PRICE_CAP_EXCEEDED,
    );

    const atCapRes = await request(app.getHttpServer())
      .post("/api/v1/resale/listings")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ ticketId: issuedTicketId, askingPriceMinor: 11000 })
      .expect(201);

    expect(atCapRes.body.askingPriceMinor).toBe(11000);
    expect(atCapRes.body.status).toBe(ResaleListingStatus.ACTIVE);
  });

  it("rejects listing a CHECKED_IN ticket with 409 Conflict", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/resale/listings")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ ticketId: checkedInTicketId, askingPriceMinor: 10000 })
      .expect(409);
  });

  it("handles two concurrent buyers racing for the same listing: one succeeds and one gets 409 Conflict", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/api/v1/resale/listings")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ ticketId: issuedTicketId, askingPriceMinor: 11000 })
      .expect(201);

    const listingId = createRes.body.id as string;

    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/resale/listings/${listingId}/purchase`)
        .set("Authorization", `Bearer ${buyer1Token}`)
        .set("Idempotency-Key", "race-idem-1")
        .send({ paymentMethodToken: "tok_visa" }),
      request(app.getHttpServer())
        .post(`/api/v1/resale/listings/${listingId}/purchase`)
        .set("Authorization", `Bearer ${buyer2Token}`)
        .set("Idempotency-Key", "race-idem-2")
        .send({ paymentMethodToken: "tok_visa" }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);
  });

  it("transfers ownership, increments seedVersion, writes balanced ledger rows, and invalidates previous owner QR token at gate/scan", async () => {
    // Seller generates dynamic QR before resale (seedVersion = 1)
    const oldQrRes = await request(app.getHttpServer())
      .get(`/api/v1/tickets/${issuedTicketId}/dynamic-qr`)
      .set("Authorization", `Bearer ${sellerToken}`)
      .expect(200);
    const oldQrToken = oldQrRes.body.token as string;

    // Create listing at 11000
    const createRes = await request(app.getHttpServer())
      .post("/api/v1/resale/listings")
      .set("Authorization", `Bearer ${sellerToken}`)
      .send({ ticketId: issuedTicketId, askingPriceMinor: 11000 })
      .expect(201);
    const listingId = createRes.body.id as string;

    // Buyer1 purchases listing
    const purchaseRes = await request(app.getHttpServer())
      .post(`/api/v1/resale/listings/${listingId}/purchase`)
      .set("Authorization", `Bearer ${buyer1Token}`)
      .set("Idempotency-Key", "purchase-idem-1")
      .send({ paymentMethodToken: "tok_visa" })
      .expect(201);

    expect(purchaseRes.body.buyerId).toBe(buyer1Id);
    expect(purchaseRes.body.seedVersion).toBe(2);
    expect(purchaseRes.body.status).toBe(ResaleListingStatus.SOLD);

    // Verify ticket ownership & seedVersion in store
    const updatedTicket = ticketsStore.get(issuedTicketId)!;
    expect(updatedTicket.ownerId).toBe(buyer1Id);
    expect(updatedTicket.seedVersion).toBe(2);

    // Verify ledger rows sum to asking price (11000)
    expect(ledgerStore).toHaveLength(2);
    const commissionRow = ledgerStore.find(
      (r) => r.kind === LedgerEntryKind.PLATFORM_COMMISSION,
    );
    const payoutRow = ledgerStore.find(
      (r) => r.kind === LedgerEntryKind.SELLER_PAYOUT,
    );
    expect(commissionRow?.amountMinor).toBe(1100);
    expect(payoutRow?.amountMinor).toBe(9900);
    expect(
      Number(commissionRow?.amountMinor) + Number(payoutRow?.amountMinor),
    ).toBe(11000);

    // Previous owner's QR token (seedVersion 1) MUST be rejected by /api/v1/gate/scan (400 TICKET_INVALID)
    const oldScanRes = await request(app.getHttpServer())
      .post("/api/v1/gate/scan")
      .set("Authorization", `Bearer ${gateStaffToken}`)
      .send({ token: oldQrToken, eventId })
      .expect(400);

    expect(oldScanRes.body.error.code).toBe(ErrorCode.TICKET_INVALID);

    // New owner's QR token (seedVersion 2) succeeds at gate/scan
    const newQr = await ticketsService.getDynamicQr(issuedTicketId, {
      id: buyer1Id,
      role: UserRole.CUSTOMER,
    });
    const newScanRes = await request(app.getHttpServer())
      .post("/api/v1/gate/scan")
      .set("Authorization", `Bearer ${gateStaffToken}`)
      .send({ token: newQr.token, eventId })
      .expect(200);

    expect(newScanRes.body.result).toBe(ScanResult.VALID);
  });
});
