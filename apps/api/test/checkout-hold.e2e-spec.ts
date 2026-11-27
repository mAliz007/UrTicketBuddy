import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { loadEnv } from "@urticketbuddy/config";
import { ErrorCode, UserRole } from "@urticketbuddy/contracts";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { GlobalHttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import {
  DATA_SOURCE,
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  MONGO_CONNECTION,
  ORDER_ITEM_REPOSITORY,
  ORDER_REPOSITORY,
  REDIS_CLIENT,
  VENUE_LAYOUT_MODEL,
  VENUE_REPOSITORY,
} from "../src/database/database.tokens";
import {
  CHECKOUT_REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
} from "../src/modules/checkout/checkout.tokens";

jest.setTimeout(30000);

describe("Checkout Hold API (e2e - Supertest)", () => {
  let app: INestApplication;

  const heldSeats = new Map<string, string>();
  const publishedMessages: Array<{ channel: string; message: string }> = [];

  const mockRedis = {
    publish: jest.fn(async (channel: string, message: string) => {
      publishedMessages.push({ channel, message });
      return 1;
    }),
    quit: jest.fn().mockResolvedValue("OK"),
  };

  const mockRedisScripts = {
    holdSeats: jest.fn(
      async (params: {
        eventId: string;
        userId: string;
        seatIds: string[];
      }) => {
        const conflicts = params.seatIds.filter((seatId) => {
          const holder = heldSeats.get(`${params.eventId}:${seatId}`);
          return holder !== undefined && holder !== params.userId;
        });

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

        for (const seatId of params.seatIds) {
          heldSeats.set(`${params.eventId}:${seatId}`, params.userId);
        }

        return {
          success: true,
          ok: true,
          code: "OK",
          expiresAt: Date.now() + 600_000,
          seatIds: params.seatIds,
          conflictingSeats: [],
          conflicts: [],
        };
      },
    ),
    releaseSeats: jest.fn(
      async (eventId: string, userId: string, seatIds: string[]) => {
        const notOwned = seatIds.filter(
          (s) => heldSeats.get(`${eventId}:${s}`) !== userId,
        );
        if (notOwned.length > 0) {
          return {
            success: false,
            ok: false,
            code: ErrorCode.SEAT_NOT_HELD_BY_YOU,
            releasedSeats: [],
            failedSeats: notOwned,
          };
        }
        for (const s of seatIds) {
          heldSeats.delete(`${eventId}:${s}`);
        }
        return {
          success: true,
          ok: true,
          code: "OK",
          releasedSeats: seatIds,
          failedSeats: [],
        };
      },
    ),
    getSnapshot: jest.fn(async (eventId: string) => {
      const holds: Record<string, string> = {};
      for (const [k, v] of heldSeats.entries()) {
        if (k.startsWith(`${eventId}:`)) {
          holds[k.slice(eventId.length + 1)] = v;
        }
      }
      return { holds, sold: [] };
    }),
    getCounts: jest.fn(async (eventId: string) => {
      let held = 0;
      for (const k of heldSeats.keys()) {
        if (k.startsWith(`${eventId}:`)) held++;
      }
      return { held, sold: 0 };
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATA_SOURCE)
      .useValue({
        isInitialized: true,
        destroy: jest.fn(),
        getRepository: jest.fn().mockReturnValue({}),
      })
      .overrideProvider(MONGO_CONNECTION)
      .useValue({ readyState: 1 })
      .overrideProvider(VENUE_REPOSITORY)
      .useValue({})
      .overrideProvider(EVENT_REPOSITORY)
      .useValue({})
      .overrideProvider(EVENT_SEAT_REPOSITORY)
      .useValue({})
      .overrideProvider(ORDER_REPOSITORY)
      .useValue({})
      .overrideProvider(ORDER_ITEM_REPOSITORY)
      .useValue({})
      .overrideProvider(VENUE_LAYOUT_MODEL)
      .useValue({})
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedis)
      .overrideProvider(CHECKOUT_REDIS_CLIENT)
      .useValue(mockRedis)
      .overrideProvider(REDIS_SCRIPTS_WRAPPER)
      .useValue(mockRedisScripts)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();
  });

  beforeEach(() => {
    heldSeats.clear();
    publishedMessages.length = 0;
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  const eventId = "11111111-1111-4111-8111-111111111111";
  const userA = "22222222-2222-4222-8222-222222222222";
  const userB = "33333333-3333-4333-8333-333333333333";

  it("POST /api/v1/checkout/hold holds seats, publishes Pub/Sub with expiresAt, and returns expiresAt", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/checkout/hold")
      .set("x-user-id", userA)
      .send({ eventId, seatIds: ["sec1-A-1", "sec1-A-2"] })
      .expect(201);

    expect(res.body.eventId).toBe(eventId);
    expect(res.body.userId).toBe(userA);
    expect(res.body.seatIds).toEqual(["sec1-A-1", "sec1-A-2"]);
    expect(typeof res.body.expiresAt).toBe("number");
    expect(publishedMessages).toHaveLength(1);
    expect(publishedMessages[0].channel).toBe("seat.state");
    expect(JSON.parse(publishedMessages[0].message)).toEqual({
      eventId,
      seatIds: ["sec1-A-1", "sec1-A-2"],
      state: "HELD",
      userId: userA,
      expiresAt: res.body.expiresAt,
    });
  });

  it("F-5: POST/DELETE /api/v1/events/:eventId/seats/hold (CUSTOMER only) and GET /api/v1/events/:eventId/seats/state", async () => {
    const env = loadEnv();
    const jwtService = new JwtService({ secret: env.JWT_SECRET });
    const customerToken = jwtService.sign({
      sub: userA,
      id: userA,
      email: "customer@example.com",
      role: UserRole.CUSTOMER,
    });
    const organizerToken = jwtService.sign({
      sub: userB,
      id: userB,
      email: "organizer@example.com",
      role: UserRole.ORGANIZER,
    });

    // ORGANIZER is rejected (CUSTOMER only)
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/seats/hold`)
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({ seatIds: ["sec1-A-1"] })
      .expect(403);

    // CUSTOMER holds seats via POST /events/:eventId/seats/hold
    const holdRes = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/seats/hold`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ seatIds: ["sec1-A-1", "sec1-A-2"] })
      .expect(201);

    expect(holdRes.body.seatIds).toEqual(["sec1-A-1", "sec1-A-2"]);
    expect(publishedMessages[0].channel).toBe("seat.state");

    // GET /events/:eventId/seats/state returns active holds and counts
    const stateRes = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/seats/state`)
      .expect(200);
    expect(stateRes.body.counts.held).toBe(2);
    expect(stateRes.body.holds["sec1-A-1"]).toBe(userA);

    // DELETE /events/:eventId/seats/hold releases seats and publishes AVAILABLE on seat.state
    const delRes = await request(app.getHttpServer())
      .delete(`/api/v1/events/${eventId}/seats/hold`)
      .set("Authorization", `Bearer ${customerToken}`)
      .send({ seatIds: ["sec1-A-1"] })
      .expect(200);

    expect(delRes.body.state).toBe("AVAILABLE");
    expect(publishedMessages[1].channel).toBe("seat.state");
  });

  it("POST /api/v1/checkout/hold returns 409 Conflict for already-held seats", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/checkout/hold")
      .set("x-user-id", userA)
      .send({ eventId, seatIds: ["sec1-A-1"] })
      .expect(201);

    const conflictRes = await request(app.getHttpServer())
      .post("/api/v1/checkout/hold")
      .set("x-user-id", userB)
      .send({ eventId, seatIds: ["sec1-A-1", "sec1-A-2"] })
      .expect(409);

    expect(conflictRes.body.error.code).toBe(ErrorCode.SEAT_ALREADY_HELD);
    expect(conflictRes.body.error.details).toEqual({
      conflictingSeats: ["sec1-A-1"],
    });
    expect(publishedMessages).toHaveLength(1);
  });

  it("POST /api/v1/checkout/hold returns 401 when x-user-id header is missing", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/checkout/hold")
      .send({ eventId, seatIds: ["sec1-A-1"] })
      .expect(401);

    expect(res.body.error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it("POST /api/v1/checkout/hold returns 400 for invalid body", async () => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/checkout/hold")
      .set("x-user-id", userA)
      .send({ eventId: "not-a-uuid", seatIds: [] })
      .expect(400);

    expect(res.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });
});
