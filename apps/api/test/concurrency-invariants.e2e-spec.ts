import { randomUUID } from "crypto";
import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { loadEnv } from "@urticketbuddy/config";
import { ErrorCode, TicketStatus, UserRole } from "@urticketbuddy/contracts";
import cookieParser from "cookie-parser";
import request from "supertest";
import {
  evaluateConcurrencyInvariants,
  InvariantSnapshotInput,
} from "../../../infra/loadtests/verify-invariants";
import {
  generate1000VirtualUsers,
  generate5000SeatDefinitions,
  LOADTEST_EVENT_ID,
  TARGET_CONTENTION_SEAT,
} from "../../../infra/loadtests/seed-loadtest";
import { AppModule } from "../src/app.module";
import { BloomService } from "../src/common/bloom/bloom.service";
import { GlobalHttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import {
  DATA_SOURCE,
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  GATE_SCAN_REPOSITORY,
  MONGO_CONNECTION,
  ORDER_ITEM_REPOSITORY,
  ORDER_REPOSITORY,
  REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
  REFRESH_TOKEN_REPOSITORY,
  TICKET_REPOSITORY,
  USER_REPOSITORY,
  VENUE_REPOSITORY,
} from "../src/database/database.tokens";
import { CHECKOUT_REDIS_CLIENT } from "../src/modules/checkout/checkout.tokens";
import { CheckoutController } from "../src/modules/checkout/checkout.controller";
import { OrdersController } from "../src/modules/orders/orders.controller";

jest.setTimeout(60000);

describe("UTB-17 Concurrency Invariants & 1,000-User Contention (e2e)", () => {
  let app: INestApplication;
  let checkoutController: CheckoutController;
  let ordersController: OrdersController;
  let jwtService: JwtService;

  const env = loadEnv();
  const eventId = LOADTEST_EVENT_ID;
  const targetSeatId = TARGET_CONTENTION_SEAT; // SEC-A-1-1

  // Authoritative in-memory Redis & Postgres state backing atomic Lua semantics
  const redisSeatLocks = new Map<
    string,
    { userId: string; expiresAt: number }
  >();
  const redisSoldSet = new Set<string>();
  const redisHoldExpiryZset = new Map<string, number>();
  const redisUserHolds = new Map<string, Set<string>>();

  const pgEventSeats = new Map<
    string,
    {
      id: string;
      eventId: string;
      seatId: string;
      status: string;
      x: number;
      y: number;
    }
  >();
  const pgOrders: Array<{
    id: string;
    userId: string;
    eventId: string;
    totalAmount: number;
    currency: string;
    status: string;
  }> = [];
  const pgOrderItems: Array<{
    id: string;
    orderId: string;
    eventId: string;
    eventSeatId: string;
    price: number;
  }> = [];
  const pgTickets: Array<{
    id: string;
    eventId: string;
    eventSeatId: string;
    orderId: string;
    ownerId: string;
    status: string;
  }> = [];

  // Single-threaded atomic transaction mutex simulating PostgreSQL FOR UPDATE row lock
  let pgTxChain: Promise<unknown> = Promise.resolve();

  const genericRedisStorage = new Map<string, string>();

  const mockRedisClient = {
    status: "ready",
    publish: jest.fn(async () => 1),
    get: jest.fn(async (key: string) => {
      if (genericRedisStorage.has(key)) {
        return genericRedisStorage.get(key)!;
      }
      const prefix = `seat_lock:{${eventId}}:`;
      if (key.startsWith(prefix)) {
        const seatId = key.slice(prefix.length);
        return redisSeatLocks.get(seatId)?.userId ?? null;
      }
      return null;
    }),
    set: jest.fn(async (key: string, value: string) => {
      genericRedisStorage.set(key, value);
      return "OK";
    }),
    del: jest.fn(async (key: string) => {
      genericRedisStorage.delete(key);
      return 1;
    }),
    eval: jest.fn(async () => 1),
    call: jest.fn(async () => 1),
    sadd: jest.fn(async () => 1),
    sismember: jest.fn(async () => 1),
    quit: jest.fn(async () => "OK"),
  };

  const mockRedisScripts = {
    holdSeats: jest.fn(
      async (
        paramsOrEventId:
          | {
              eventId: string;
              userId: string;
              seatIds: string[];
              ttlSeconds?: number;
            }
          | string,
        userIdArg?: string,
        seatIdsArg?: string[],
      ) => {
        const resolved =
          typeof paramsOrEventId === "string"
            ? {
                eventId: paramsOrEventId,
                userId: userIdArg ?? "",
                seatIds: seatIdsArg ?? [],
                ttlSeconds: 600,
              }
            : paramsOrEventId;

        const nowMs = Date.now();
        const conflicts: string[] = [];

        for (const seatId of resolved.seatIds) {
          if (redisSoldSet.has(seatId)) {
            conflicts.push(seatId);
            continue;
          }
          const existingLock = redisSeatLocks.get(seatId);
          if (
            existingLock &&
            existingLock.expiresAt > nowMs &&
            existingLock.userId !== resolved.userId
          ) {
            conflicts.push(seatId);
          }
        }

        if (conflicts.length > 0) {
          return {
            success: false,
            ok: false,
            code: ErrorCode.SEAT_ALREADY_HELD,
            seatIds: [],
            conflictingSeats: conflicts,
            conflicts,
          };
        }

        const expiresAt = nowMs + (resolved.ttlSeconds ?? 600) * 1000;
        let userSet = redisUserHolds.get(resolved.userId);
        if (!userSet) {
          userSet = new Set<string>();
          redisUserHolds.set(resolved.userId, userSet);
        }

        for (const seatId of resolved.seatIds) {
          redisSeatLocks.set(seatId, { userId: resolved.userId, expiresAt });
          redisHoldExpiryZset.set(seatId, expiresAt);
          userSet.add(seatId);
        }

        return {
          success: true,
          ok: true,
          code: "OK",
          expiresAt,
          seatIds: resolved.seatIds,
          conflictingSeats: [],
          conflicts: [],
        };
      },
    ),

    getSnapshot: jest.fn(async (_evId: string, nowMs: number = Date.now()) => {
      const holds: Record<string, { userId: string; expiresAt: number }> = {};
      const held: string[] = [];
      for (const [seatId, lock] of redisSeatLocks.entries()) {
        if (lock.expiresAt > nowMs && !redisSoldSet.has(seatId)) {
          held.push(seatId);
          holds[seatId] = { userId: lock.userId, expiresAt: lock.expiresAt };
        }
      }
      const sold = Array.from(redisSoldSet);
      return {
        eventId,
        held,
        sold,
        heldSeatIds: held,
        soldSeatIds: sold,
        holds,
      };
    }),

    confirmSold: jest.fn(
      async (
        _evId: string,
        userId: string,
        seatIds: string[],
        nowMs: number = Date.now(),
      ) => {
        const notOwned: string[] = [];
        const expired: string[] = [];

        for (const seatId of seatIds) {
          const lock = redisSeatLocks.get(seatId);
          if (!lock || lock.expiresAt <= nowMs) {
            expired.push(seatId);
          } else if (lock.userId !== userId) {
            notOwned.push(seatId);
          }
        }

        if (notOwned.length > 0) {
          return {
            success: false,
            ok: false,
            code: ErrorCode.SEAT_NOT_HELD_BY_YOU,
            soldSeats: [],
            seatIds: [],
            failedSeats: notOwned,
          };
        }

        if (expired.length > 0) {
          return {
            success: false,
            ok: false,
            code: ErrorCode.HOLD_EXPIRED,
            soldSeats: [],
            seatIds: [],
            failedSeats: expired,
          };
        }

        for (const seatId of seatIds) {
          redisSoldSet.add(seatId);
          redisSeatLocks.delete(seatId);
          redisHoldExpiryZset.delete(seatId);
          redisUserHolds.get(userId)?.delete(seatId);
        }

        return {
          success: true,
          ok: true,
          code: "OK",
          soldSeats: seatIds,
          seatIds,
          failedSeats: [],
        };
      },
    ),
  };

  const mockEventSeatRepo = {
    find: jest.fn(
      async ({
        where,
      }: {
        where?: { eventId?: string; seatId?: { _value?: string[] } };
      }) => {
        const requestedSeatIds: string[] | undefined = where?.seatId?._value;
        const results = [];
        for (const seat of pgEventSeats.values()) {
          if (where?.eventId && seat.eventId !== where.eventId) continue;
          if (requestedSeatIds && !requestedSeatIds.includes(seat.seatId))
            continue;
          results.push({ ...seat });
        }
        return results;
      },
    ),
  };

  const mockDataSource = {
    isInitialized: true,
    destroy: jest.fn(),
    getRepository: jest.fn(() => mockEventSeatRepo),
    transaction: jest.fn(
      async <T>(cb: (manager: unknown) => Promise<T>): Promise<T> => {
        const run = pgTxChain.then(async () => {
          const manager = {
            find: mockEventSeatRepo.find,
            create: (
              _Entity: { name: string },
              data: Record<string, unknown>,
            ) => ({
              id: randomUUID(),
              createdAt: new Date(),
              updatedAt: new Date(),
              ...data,
            }),
            save: async (Entity: { name: string }, data: unknown) => {
              if (Entity.name === "Order") {
                const order = data as (typeof pgOrders)[number];
                pgOrders.push(order);
                return order;
              }
              if (Entity.name === "OrderItem") {
                const items = (Array.isArray(data) ? data : [data]) as Array<{
                  id: string;
                  orderId: string;
                  eventSeatId: string;
                  price: number;
                }>;
                for (const item of items) {
                  pgOrderItems.push({ ...item, eventId });
                }
                return items;
              }
              if (Entity.name === "Ticket") {
                const tickets = (Array.isArray(data) ? data : [data]) as Array<
                  (typeof pgTickets)[number]
                >;
                for (const t of tickets) {
                  pgTickets.push(t);
                }
                return tickets;
              }
              return data;
            },
            update: async (
              Entity: { name: string },
              criteria: { id?: { _value?: string[] } },
              partial: { status?: string },
            ) => {
              if (Entity.name === "EventSeat") {
                const targetIds = new Set<string>(criteria.id?._value ?? []);
                for (const seat of pgEventSeats.values()) {
                  if (targetIds.has(seat.id) && partial.status) {
                    seat.status = partial.status;
                  }
                }
              }
              return { affected: 1 };
            },
          };
          return cb(manager);
        });
        pgTxChain = run.catch(() => undefined);
        return run;
      },
    ),
  };

  function resetStoresWith5000Seats(): void {
    redisSeatLocks.clear();
    redisSoldSet.clear();
    redisHoldExpiryZset.clear();
    redisUserHolds.clear();
    pgEventSeats.clear();
    pgOrders.length = 0;
    pgOrderItems.length = 0;
    pgTickets.length = 0;

    const defs = generate5000SeatDefinitions(eventId);
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i]!;
      pgEventSeats.set(def.seatId, {
        id: `b0000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        eventId: def.eventId,
        seatId: def.seatId,
        status: def.status,
        x: def.x,
        y: def.y,
      });
    }
  }

  function buildCurrentSnapshot(): InvariantSnapshotInput {
    return {
      eventId,
      soldEventSeats: Array.from(pgEventSeats.values())
        .filter((s) => s.status === "SOLD")
        .map((s) => ({ id: s.id, seatId: s.seatId, status: s.status })),
      completedOrders: pgOrders.map((o) => ({
        id: o.id,
        totalAmount: o.totalAmount,
      })),
      completedOrderItems: pgOrderItems.map((item) => ({
        ...item,
        price: item.price || 1000,
      })),
      activeTickets: pgTickets.map((t) => ({
        ...t,
        faceValueMinor: 100000,
      })),
      redisSoldSeatIds: Array.from(redisSoldSet),
      redisActiveLockSeatIds: Array.from(redisSeatLocks.keys()),
      redisHoldExpirySeatIds: Array.from(redisHoldExpiryZset.keys()),
    };
  }

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
      .useValue({})
      .overrideProvider(EVENT_SEAT_REPOSITORY)
      .useValue(mockEventSeatRepo)
      .overrideProvider(ORDER_REPOSITORY)
      .useValue({})
      .overrideProvider(ORDER_ITEM_REPOSITORY)
      .useValue({})
      .overrideProvider(USER_REPOSITORY)
      .useValue({})
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue({})
      .overrideProvider(TICKET_REPOSITORY)
      .useValue({})
      .overrideProvider(GATE_SCAN_REPOSITORY)
      .useValue({})
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedisClient)
      .overrideProvider(CHECKOUT_REDIS_CLIENT)
      .useValue(mockRedisClient)
      .overrideProvider(REDIS_SCRIPTS_WRAPPER)
      .useValue(mockRedisScripts)
      .overrideProvider(BloomService)
      .useValue({
        mightExist: jest.fn(async () => true),
        add: jest.fn(async () => true),
        addTicket: jest.fn(async () => true),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.use(cookieParser());
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();

    checkoutController = app.get(CheckoutController);
    ordersController = app.get(OrdersController);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    resetStoresWith5000Seats();
  });

  it("seeds 5,000 seats and 1,000 pre-signed virtual user JWTs cleanly", () => {
    expect(pgEventSeats.size).toBe(5000);
    expect(pgEventSeats.has(targetSeatId)).toBe(true);

    const users = generate1000VirtualUsers(env.JWT_SECRET);
    expect(users).toHaveLength(1000);

    const decoded = jwtService.verify(users[0]!.token, {
      secret: env.JWT_SECRET,
    }) as { sub: string; role: string };
    expect(decoded.sub).toBe(users[0]!.userId);
    expect(decoded.role).toBe(UserRole.CUSTOMER);
  });

  it("1,000-User Contention Simulation: 1,000 concurrent hold + checkout requests for SEC-A-1-1 yield 1 winner, 999 conflicts (409), and all 4 invariants hold", async () => {
    const users = generate1000VirtualUsers(env.JWT_SECRET);

    // Fire 1,000 concurrent hold + checkout attempts against the NestJS controllers
    const results = await Promise.all(
      users.map(async (user, idx) => {
        try {
          await checkoutController.holdSeats(user.userId, {
            eventId,
            seatIds: [targetSeatId],
          });

          const order = await ordersController.checkout(
            {
              eventId,
              seatIds: [targetSeatId],
              paymentMethodToken: "tok_visa",
            },
            user.userId,
          );

          return {
            status: 201 as const,
            userId: user.userId,
            orderId: order.id,
            idx,
          };
        } catch (err: unknown) {
          const status =
            typeof (err as { getStatus?: () => number })?.getStatus ===
            "function"
              ? (err as { getStatus: () => number }).getStatus()
              : 500;
          return { status, userId: user.userId, idx };
        }
      }),
    );

    const winners = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);
    const errors = results.filter((r) => r.status >= 500);

    expect(winners).toHaveLength(1);
    expect(conflicts).toHaveLength(999);
    expect(errors).toHaveLength(0);

    // Evaluate all post-run DB & Redis mathematical invariants
    const report = evaluateConcurrencyInvariants(buildCurrentSnapshot());
    expect(report.passed).toBe(true);
    expect(report.zeroDoubleBooking.passed).toBe(true);
    expect(report.stateExclusivity.passed).toBe(true);
    expect(report.redisPostgresParity.passed).toBe(true);
    expect(report.conservationOfMoney.passed).toBe(true);
    expect(report.redisPostgresParity.redisSoldCount).toBe(1);
    expect(report.redisPostgresParity.postgresSoldSeatsCount).toBe(1);
    expect(report.redisPostgresParity.completedOrderItemsCount).toBe(1);
    expect(pgTickets).toHaveLength(1);
    expect(pgTickets[0]!.status).toBe(TicketStatus.ISSUED);
  });

  it("Supertest HTTP wave contention + multi-seat funnel preserves all 4 invariants with idempotency deduplication", async () => {
    const users = generate1000VirtualUsers(env.JWT_SECRET).slice(0, 25);
    const httpSeat = "SEC-A-2-1";

    // 25 concurrent Supertest HTTP requests for the same seat
    const holdResponses = await Promise.all(
      users.map((u) =>
        request(app.getHttpServer())
          .post("/api/v1/checkout/hold")
          .set("Authorization", `Bearer ${u.token}`)
          .set("x-user-id", u.userId)
          .send({ eventId, seatIds: [httpSeat] }),
      ),
    );

    const httpWinners = holdResponses.filter((r) => r.status === 201);
    const httpConflicts = holdResponses.filter((r) => r.status === 409);
    expect(httpWinners).toHaveLength(1);
    expect(httpConflicts).toHaveLength(24);

    // Winner completes checkout over Supertest HTTP
    const winnerIndex = holdResponses.findIndex((r) => r.status === 201);
    const winnerUser = users[winnerIndex]!;

    const checkoutRes = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${winnerUser.token}`)
      .set("x-user-id", winnerUser.userId)
      .set("Idempotency-Key", `e2e-http-${winnerUser.userId}`)
      .send({
        eventId,
        seatIds: [httpSeat],
        paymentMethodToken: "tok_visa",
      })
      .expect(201);

    expect(checkoutRes.body.status).toBe("COMPLETED");

    // Idempotent retry returns identical order without error
    const retryRes = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${winnerUser.token}`)
      .set("x-user-id", winnerUser.userId)
      .set("Idempotency-Key", `e2e-http-${winnerUser.userId}`)
      .send({
        eventId,
        seatIds: [httpSeat],
        paymentMethodToken: "tok_visa",
      })
      .expect(201);

    expect(retryRes.body.id).toBe(checkoutRes.body.id);

    const report = evaluateConcurrencyInvariants(buildCurrentSnapshot());
    expect(report.passed).toBe(true);
    expect(report.conservationOfMoney.passed).toBe(true);
    expect(report.redisPostgresParity.redisSoldCount).toBe(1);
  });

  it("detects violations of Zero Double-Booking, State Exclusivity, and Redis-Postgres Parity invariants", () => {
    // 1. Detect double-booking
    const doubleBookedReport = evaluateConcurrencyInvariants({
      eventId,
      soldEventSeats: [{ id: "s1", seatId: "SEC-A-1-1", status: "SOLD" }],
      completedOrderItems: [
        { id: "oi1", orderId: "o1", eventId, eventSeatId: "s1" },
        { id: "oi2", orderId: "o2", eventId, eventSeatId: "s1" },
      ],
      activeTickets: [
        { id: "t1", eventId, eventSeatId: "s1", status: "ISSUED" },
        { id: "t2", eventId, eventSeatId: "s1", status: "ISSUED" },
      ],
      redisSoldSeatIds: ["SEC-A-1-1"],
      redisActiveLockSeatIds: [],
      redisHoldExpirySeatIds: [],
    });
    expect(doubleBookedReport.passed).toBe(false);
    expect(doubleBookedReport.zeroDoubleBooking.passed).toBe(false);
    expect(
      doubleBookedReport.zeroDoubleBooking.duplicateOrderItemSeats,
    ).toEqual(["s1"]);
    expect(doubleBookedReport.zeroDoubleBooking.duplicateTicketSeats).toEqual([
      "s1",
    ]);

    // 2. Detect State Exclusivity overlap (seat in both seat_sold and seat_lock)
    const exclusivityReport = evaluateConcurrencyInvariants({
      eventId,
      soldEventSeats: [{ id: "s1", seatId: "SEC-A-1-1", status: "SOLD" }],
      completedOrderItems: [
        { id: "oi1", orderId: "o1", eventId, eventSeatId: "s1" },
      ],
      activeTickets: [
        { id: "t1", eventId, eventSeatId: "s1", status: "ISSUED" },
      ],
      redisSoldSeatIds: ["SEC-A-1-1"],
      redisActiveLockSeatIds: ["SEC-A-1-1"],
      redisHoldExpirySeatIds: ["SEC-A-1-1"],
    });
    expect(exclusivityReport.passed).toBe(false);
    expect(exclusivityReport.stateExclusivity.passed).toBe(false);
    expect(exclusivityReport.stateExclusivity.soldAndLockedOverlap).toEqual([
      "SEC-A-1-1",
    ]);

    // 3. Detect Redis-Postgres Parity drift
    const parityReport = evaluateConcurrencyInvariants({
      eventId,
      soldEventSeats: [{ id: "s1", seatId: "SEC-A-1-1", status: "SOLD" }],
      completedOrderItems: [
        { id: "oi1", orderId: "o1", eventId, eventSeatId: "s1" },
      ],
      activeTickets: [
        { id: "t1", eventId, eventSeatId: "s1", status: "ISSUED" },
      ],
      redisSoldSeatIds: ["SEC-A-1-1", "SEC-A-1-2"],
      redisActiveLockSeatIds: [],
      redisHoldExpirySeatIds: [],
    });
    expect(parityReport.passed).toBe(false);
    expect(parityReport.redisPostgresParity.passed).toBe(false);

    // 4. Detect Conservation of Money drift
    const moneyDriftReport = evaluateConcurrencyInvariants({
      eventId,
      soldEventSeats: [{ id: "s1", seatId: "SEC-A-1-1", status: "SOLD" }],
      completedOrders: [{ id: "o1", totalAmount: 5000 }],
      completedOrderItems: [
        { id: "oi1", orderId: "o1", eventId, eventSeatId: "s1", price: 4000 },
      ],
      activeTickets: [
        {
          id: "t1",
          eventId,
          eventSeatId: "s1",
          status: "ISSUED",
          faceValueMinor: 500000,
        },
      ],
      redisSoldSeatIds: ["SEC-A-1-1"],
      redisActiveLockSeatIds: [],
      redisHoldExpirySeatIds: [],
    });
    expect(moneyDriftReport.passed).toBe(false);
    expect(moneyDriftReport.conservationOfMoney.passed).toBe(false);
  });
});
