import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ErrorCode } from "@urticketbuddy/contracts";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { GlobalHttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import {
  DATA_SOURCE,
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  MONGO_CONNECTION,
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
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATA_SOURCE)
      .useValue({ isInitialized: true, destroy: jest.fn() })
      .overrideProvider(MONGO_CONNECTION)
      .useValue({ readyState: 1 })
      .overrideProvider(VENUE_REPOSITORY)
      .useValue({})
      .overrideProvider(EVENT_REPOSITORY)
      .useValue({})
      .overrideProvider(EVENT_SEAT_REPOSITORY)
      .useValue({})
      .overrideProvider(VENUE_LAYOUT_MODEL)
      .useValue({})
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
    await app.close();
  });

  const eventId = "11111111-1111-4111-8111-111111111111";
  const userA = "22222222-2222-4222-8222-222222222222";
  const userB = "33333333-3333-4333-8333-333333333333";

  it("POST /api/v1/checkout/hold holds seats, publishes Pub/Sub, and returns expiresAt", async () => {
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
    expect(publishedMessages[0].channel).toBe(`seat-updates:${eventId}`);
    expect(JSON.parse(publishedMessages[0].message)).toEqual({
      eventId,
      seatIds: ["sec1-A-1", "sec1-A-2"],
      state: "HELD",
      userId: userA,
    });
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
