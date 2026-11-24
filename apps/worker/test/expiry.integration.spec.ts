import { randomUUID } from "crypto";
import { Test, TestingModule } from "@nestjs/testing";
import { RedisKeys, RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";
import Redis from "ioredis";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import {
  WORKER_DATA_SOURCE,
  WORKER_REDIS_CLIENT,
  WORKER_REDIS_SCRIPTS,
} from "../src/infrastructure/worker-infra.tokens";
import { ExpiryService } from "../src/modules/expiry/expiry.service";

jest.setTimeout(120_000);

describe("ExpiryService (Testcontainers Redis Integration)", () => {
  let container: StartedTestContainer;
  let redis: Redis;
  let subscriber: Redis;
  let redisScripts: RedisScriptsWrapper;
  let expiryService: ExpiryService;
  let moduleRef: TestingModule;

  beforeAll(async () => {
    container = await new GenericContainer("redis/redis-stack-server:latest")
      .withExposedPorts(6379)
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(6379);

    redis = new Redis({ host, port, maxRetriesPerRequest: 3 });
    subscriber = new Redis({ host, port, maxRetriesPerRequest: 3 });
    redisScripts = new RedisScriptsWrapper(redis);

    moduleRef = await Test.createTestingModule({
      providers: [
        ExpiryService,
        { provide: WORKER_REDIS_CLIENT, useValue: redis },
        { provide: WORKER_REDIS_SCRIPTS, useValue: redisScripts },
        { provide: WORKER_DATA_SOURCE, useValue: null },
      ],
    }).compile();

    expiryService = moduleRef.get(ExpiryService);
  });

  afterAll(async () => {
    if (subscriber) {
      await subscriber.quit();
    }
    if (redis) {
      await redis.quit();
    }
    if (moduleRef) {
      await moduleRef.close();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  it("expires held seats past ZSET score, removes locks, and publishes seat-updates event", async () => {
    const eventId = randomUUID();
    const userId = randomUUID();
    const seatIds = ["SEC1-A-1", "SEC1-A-2"];
    const baseNowMs = Date.now();
    const ttlSeconds = 2;

    const holdResult = await redisScripts.holdSeats({
      eventId,
      userId,
      seatIds,
      ttlSeconds,
      maxPerUser: 6,
      nowMs: baseNowMs,
    });
    expect(holdResult.success).toBe(true);

    // Subscribe to seat-updates:{eventId}
    const receivedMessages: string[] = [];
    const channel = `seat-updates:${eventId}`;
    await subscriber.subscribe(channel);
    subscriber.on("message", (ch, msg) => {
      if (ch === channel) {
        receivedMessages.push(msg);
      }
    });

    // Before expiry: nothing should be released
    const beforeExpiry = await expiryService.processExpiredHolds(
      baseNowMs + 500,
    );
    expect(beforeExpiry).toEqual({});
    expect(await redis.get(RedisKeys.seatLock(eventId, "SEC1-A-1"))).toBe(
      userId,
    );

    // After ZSET score lapses: expire_due.lua should free both seats and publish
    const afterExpiry = await expiryService.processExpiredHolds(
      baseNowMs + ttlSeconds * 1000 + 500,
    );
    expect(afterExpiry[eventId]).toHaveLength(2);
    expect(afterExpiry[eventId]).toEqual(expect.arrayContaining(seatIds));

    // Verify Redis locks and ZSET are cleaned up
    expect(await redis.get(RedisKeys.seatLock(eventId, "SEC1-A-1"))).toBeNull();
    expect(await redis.get(RedisKeys.seatLock(eventId, "SEC1-A-2"))).toBeNull();
    expect(await redis.zcard(RedisKeys.holdExpiry(eventId))).toBe(0);
    expect(await redis.scard(RedisKeys.userHolds(eventId, userId))).toBe(0);

    // Wait briefly for Pub/Sub message delivery
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(receivedMessages).toHaveLength(1);
    const parsed = JSON.parse(receivedMessages[0]!) as {
      eventId: string;
      seatIds: string[];
      state: string;
      source: string;
    };
    expect(parsed.eventId).toBe(eventId);
    expect(parsed.seatIds).toEqual(expect.arrayContaining(seatIds));
    expect(parsed.state).toBe("AVAILABLE");
    expect(parsed.source).toBe("WORKER_EXPIRY");

    await subscriber.unsubscribe(channel);
  });
});
