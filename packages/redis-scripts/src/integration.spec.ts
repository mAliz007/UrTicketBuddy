import { randomUUID } from "crypto";
import Redis from "ioredis";
import { GenericContainer, StartedTestContainer } from "testcontainers";
import { ErrorCode } from "@urticketbuddy/contracts";
import { RedisKeys, RedisScriptsWrapper } from "./index";

jest.setTimeout(300_000);

describe("packages/redis-scripts (Testcontainers redis-stack integration)", () => {
  let container: StartedTestContainer;
  let redis: Redis;
  let engine: RedisScriptsWrapper;

  beforeAll(async () => {
    container = await new GenericContainer("redis/redis-stack-server:latest")
      .withExposedPorts(6379)
      .start();

    redis = new Redis({
      host: container.getHost(),
      port: container.getMappedPort(6379),
      maxRetriesPerRequest: 3,
    });

    engine = new RedisScriptsWrapper(redis);
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
    if (container) {
      await container.stop();
    }
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  it("500 simultaneous hold attempts on a single seat: exactly ONE wins and 499 fail", async () => {
    const eventId = randomUUID();
    const targetSeatId = "SEC1-A-1";
    const userIds = Array.from({ length: 500 }, () => randomUUID());

    const results = await Promise.all(
      userIds.map((userId) =>
        engine.holdSeats({
          eventId,
          userId,
          seatIds: [targetSeatId],
          ttlSeconds: 600,
          maxPerUser: 6,
        }),
      ),
    );

    const winners = results.filter((r) => r.success);
    const losers = results.filter((r) => !r.success);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(499);

    const winner = winners[0]!;
    expect(winner.code).toBe("OK");
    expect(winner.expiresAt).toEqual(expect.any(Number));
    expect(winner.seatIds).toEqual([targetSeatId]);

    for (const loser of losers) {
      expect(loser.code).toBe(ErrorCode.SEAT_ALREADY_HELD);
      expect(loser.conflictingSeats).toEqual([targetSeatId]);
    }

    const counts = await engine.getCounts(eventId);
    expect(counts.held).toBe(1);
    expect(counts.sold).toBe(0);

    const snapshot = await engine.getSnapshot(eventId);
    expect(snapshot.held).toEqual([targetSeatId]);
    expect(snapshot.sold).toEqual([]);
  });

  it("overlapping multi-seat holds never leave partial locks", async () => {
    const eventId = randomUUID();
    const user1 = randomUUID();
    const user2 = randomUUID();

    // 1. Deterministic overlap: user1 holds A-1-2, user2 requests [A-1-1, A-1-2, A-1-3]
    const hold1 = await engine.holdSeats(eventId, user1, ["A-1-2"], 600, 6);
    expect(hold1.success).toBe(true);

    const hold2 = await engine.holdSeats(
      eventId,
      user2,
      ["A-1-1", "A-1-2", "A-1-3"],
      600,
      6,
    );
    expect(hold2.success).toBe(false);
    expect(hold2.code).toBe(ErrorCode.SEAT_ALREADY_HELD);
    expect(hold2.conflictingSeats).toEqual(["A-1-2"]);

    // Verify A-1-1 and A-1-3 were NOT partially locked
    expect(await redis.get(RedisKeys.seatLock(eventId, "A-1-1"))).toBeNull();
    expect(await redis.get(RedisKeys.seatLock(eventId, "A-1-3"))).toBeNull();
    expect(
      await redis.zscore(RedisKeys.holdExpiry(eventId), "A-1-1"),
    ).toBeNull();
    expect(
      await redis.zscore(RedisKeys.holdExpiry(eventId), "A-1-3"),
    ).toBeNull();
    expect(await redis.scard(RedisKeys.userHolds(eventId, user2))).toBe(0);

    // 2. Concurrent overlapping multi-seat bundles across 60 simultaneous buyers
    const concurrentEventId = randomUUID();
    const bundles = Array.from({ length: 60 }, (_, idx) => {
      const start = (idx % 8) + 1;
      return {
        userId: randomUUID(),
        seatIds: [`B-1-${start}`, `B-1-${start + 1}`, `B-1-${start + 2}`],
      };
    });

    const bundleResults = await Promise.all(
      bundles.map((b) =>
        engine.holdSeats({
          eventId: concurrentEventId,
          userId: b.userId,
          seatIds: b.seatIds,
          ttlSeconds: 600,
          maxPerUser: 6,
        }),
      ),
    );

    for (let i = 0; i < bundles.length; i++) {
      const bundle = bundles[i]!;
      const res = bundleResults[i]!;
      const userHoldMembers = await redis.smembers(
        RedisKeys.userHolds(concurrentEventId, bundle.userId),
      );

      if (res.success) {
        // Every seat in the bundle must be locked by this winner
        expect(userHoldMembers.sort()).toEqual([...bundle.seatIds].sort());
        for (const seatId of bundle.seatIds) {
          const lockOwner = await redis.get(
            RedisKeys.seatLock(concurrentEventId, seatId),
          );
          expect(lockOwner).toBe(bundle.userId);
        }
      } else {
        // Failed multi-seat attempt must leave ZERO locks or user_holds for this user
        expect(userHoldMembers).toHaveLength(0);
        for (const seatId of bundle.seatIds) {
          const lockOwner = await redis.get(
            RedisKeys.seatLock(concurrentEventId, seatId),
          );
          expect(lockOwner).not.toBe(bundle.userId);
        }
      }
    }
  });

  it("enforces maxPerUser atomically and allows idempotent re-holds by same user", async () => {
    const eventId = randomUUID();
    const userId = randomUUID();

    const firstBatch = await engine.holdSeats({
      eventId,
      userId,
      seatIds: ["C-1-1", "C-1-2", "C-1-3"],
      ttlSeconds: 600,
      maxPerUser: 4,
    });
    expect(firstBatch.success).toBe(true);

    // Exceeding maxPerUser (3 existing + 2 new = 5 > 4) must fail completely
    const overLimit = await engine.holdSeats({
      eventId,
      userId,
      seatIds: ["C-1-4", "C-1-5"],
      ttlSeconds: 600,
      maxPerUser: 4,
    });
    expect(overLimit.success).toBe(false);
    expect(overLimit.code).toBe(ErrorCode.TOO_MANY_SEATS);
    expect(await redis.get(RedisKeys.seatLock(eventId, "C-1-4"))).toBeNull();
    expect(await redis.get(RedisKeys.seatLock(eventId, "C-1-5"))).toBeNull();

    // Holding 1 existing + 1 new (total 4 <= 4) succeeds
    const withinLimit = await engine.holdSeats({
      eventId,
      userId,
      seatIds: ["C-1-3", "C-1-4"],
      ttlSeconds: 600,
      maxPerUser: 4,
    });
    expect(withinLimit.success).toBe(true);
    expect((await engine.getCounts(eventId)).held).toBe(4);
  });

  it("enforces ownership on release_seats, confirm_sold, and supports unsell_seats", async () => {
    const eventId = randomUUID();
    const ownerId = randomUUID();
    const attackerId = randomUUID();

    await engine.holdSeats(eventId, ownerId, ["D-1-1", "D-1-2"], 600, 6);

    // Non-owner cannot release
    const badRelease = await engine.releaseSeats(eventId, attackerId, [
      "D-1-1",
    ]);
    expect(badRelease.success).toBe(false);
    expect(badRelease.code).toBe(ErrorCode.SEAT_NOT_HELD_BY_YOU);

    // Owner releases D-1-1
    const goodRelease = await engine.releaseSeats(eventId, ownerId, ["D-1-1"]);
    expect(goodRelease.success).toBe(true);
    expect(await redis.get(RedisKeys.seatLock(eventId, "D-1-1"))).toBeNull();

    // Non-owner cannot confirm_sold on D-1-2
    const badConfirm = await engine.confirmSold(eventId, attackerId, ["D-1-2"]);
    expect(badConfirm.success).toBe(false);
    expect(badConfirm.code).toBe(ErrorCode.SEAT_NOT_HELD_BY_YOU);

    // Owner confirms D-1-2 as sold
    const goodConfirm = await engine.confirmSold(eventId, ownerId, ["D-1-2"]);
    expect(goodConfirm.success).toBe(true);
    expect(goodConfirm.soldSeats).toEqual(["D-1-2"]);

    // Verify D-1-2 is in seat_sold and lock/zset are cleaned up
    expect(await redis.get(RedisKeys.seatLock(eventId, "D-1-2"))).toBeNull();
    expect(
      await redis.zscore(RedisKeys.holdExpiry(eventId), "D-1-2"),
    ).toBeNull();
    const snapshotAfterSale = await engine.getSnapshot(eventId);
    expect(snapshotAfterSale.held).toEqual([]);
    expect(snapshotAfterSale.sold).toEqual(["D-1-2"]);

    // Attempting to hold a sold seat fails with SEAT_ALREADY_HELD
    const holdSold = await engine.holdSeats(
      eventId,
      attackerId,
      ["D-1-2"],
      600,
      6,
    );
    expect(holdSold.success).toBe(false);
    expect(holdSold.code).toBe(ErrorCode.SEAT_ALREADY_HELD);
    expect(holdSold.conflictingSeats).toEqual(["D-1-2"]);

    // Admin unsell_seats revokes sold status so seat can be held again
    const unsell = await engine.unsellSeats(eventId, ["D-1-2"]);
    expect(unsell.success).toBe(true);
    expect(unsell.unsoldSeats).toEqual(["D-1-2"]);
    expect((await engine.getCounts(eventId)).sold).toBe(0);

    const reholdAfterUnsell = await engine.holdSeats(
      eventId,
      attackerId,
      ["D-1-2"],
      600,
      6,
    );
    expect(reholdAfterUnsell.success).toBe(true);
  });

  it("extends hold once per user per event (+120s grace period) and expires due holds", async () => {
    const eventId = randomUUID();
    const user1 = randomUUID();
    const user2 = randomUUID();
    const baseNow = Date.now();

    const hold1 = await engine.holdSeats({
      eventId,
      userId: user1,
      seatIds: ["E-1-1", "E-1-2"],
      ttlSeconds: 600,
      maxPerUser: 6,
      nowMs: baseNow,
    });
    expect(hold1.success).toBe(true);

    // First extension adds 120s (120,000 ms)
    const ext1 = await engine.extendHold({
      eventId,
      userId: user1,
      seatIds: ["E-1-1", "E-1-2"],
      graceSeconds: 120,
      nowMs: baseNow,
    });
    expect(ext1.success).toBe(true);
    expect(ext1.expiresAt).toBe(baseNow + (600 + 120) * 1000);

    // Second extension by same user on same event is rejected
    const ext2 = await engine.extendHold({
      eventId,
      userId: user1,
      seatIds: ["E-1-1", "E-1-2"],
      graceSeconds: 120,
      nowMs: baseNow,
    });
    expect(ext2.success).toBe(false);
    expect(ext2.code).toBe("HOLD_ALREADY_EXTENDED");

    // Hold another seat for user2 that expires sooner
    await engine.holdSeats({
      eventId,
      userId: user2,
      seatIds: ["E-2-1"],
      ttlSeconds: 60,
      maxPerUser: 6,
      nowMs: baseNow,
    });

    // Advance simulated clock past user2's 60s hold but before user1's 720s hold
    const freed = await engine.expireDue(eventId, baseNow + 61_000);
    expect(freed).toEqual(["E-2-1"]);

    // Verify E-2-1 lock and user_holds are gone while E-1-1 and E-1-2 remain held
    expect(await redis.get(RedisKeys.seatLock(eventId, "E-2-1"))).toBeNull();
    expect(await redis.scard(RedisKeys.userHolds(eventId, user2))).toBe(0);

    const snapshot = await engine.getSnapshot(eventId, baseNow + 61_000);
    expect(snapshot.held).toEqual(["E-1-1", "E-1-2"]);
  });
});
