import { Test } from "@nestjs/testing";
import { RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";
import Redis from "ioredis";
import { DataSource } from "typeorm";
import {
  WORKER_DATA_SOURCE,
  WORKER_REDIS_CLIENT,
  WORKER_REDIS_SCRIPTS,
} from "../src/infrastructure/worker-infra.tokens";
import { ExpiryService } from "../src/modules/expiry/expiry.service";

describe("ExpiryService (Unit)", () => {
  let service: ExpiryService;
  let mockRedis: {
    scan: jest.Mock;
    publish: jest.Mock;
    set: jest.Mock;
    eval: jest.Mock;
  };
  let mockRedisScripts: {
    expireDue: jest.Mock;
  };
  let mockQueryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };
  let mockDataSource: {
    isInitialized: boolean;
    initialize: jest.Mock;
    getRepository: jest.Mock;
  };

  beforeEach(async () => {
    mockRedis = {
      scan: jest.fn().mockResolvedValue(["0", []]),
      publish: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue("OK"),
      eval: jest.fn().mockResolvedValue(1),
    };

    mockRedisScripts = {
      expireDue: jest.fn().mockResolvedValue([]),
    };

    mockQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockDataSource = {
      isInitialized: false,
      initialize: jest.fn().mockResolvedValue(undefined),
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExpiryService,
        {
          provide: WORKER_REDIS_CLIENT,
          useValue: mockRedis as unknown as Redis,
        },
        {
          provide: WORKER_REDIS_SCRIPTS,
          useValue: mockRedisScripts as unknown as RedisScriptsWrapper,
        },
        {
          provide: WORKER_DATA_SOURCE,
          useValue: mockDataSource as unknown as DataSource,
        },
      ],
    }).compile();

    service = moduleRef.get(ExpiryService);
  });

  it("returns empty map when no active hold_expiry keys exist", async () => {
    mockRedis.scan.mockResolvedValueOnce(["0", []]);

    const result = await service.processExpiredHolds(1_000_000);

    expect(result).toEqual({});
    expect(mockRedisScripts.expireDue).not.toHaveBeenCalled();
    expect(mockRedis.publish).not.toHaveBeenCalled();
  });

  it("scans multiple cursors, deduplicates eventIds, and skips publish when no seats expired", async () => {
    const eventId = "11111111-1111-4111-8111-111111111111";
    mockRedis.scan
      .mockResolvedValueOnce(["42", [`hold_expiry:{${eventId}}`]])
      .mockResolvedValueOnce(["0", [`hold_expiry:{${eventId}}`]]);
    mockRedisScripts.expireDue.mockResolvedValueOnce([]);

    const result = await service.processExpiredHolds(1_000_000);

    expect(result).toEqual({});
    expect(mockRedis.scan).toHaveBeenCalledTimes(2);
    expect(mockRedisScripts.expireDue).toHaveBeenCalledTimes(1);
    expect(mockRedisScripts.expireDue).toHaveBeenCalledWith(eventId, 1_000_000);
    expect(mockRedis.publish).not.toHaveBeenCalled();
  });

  it("calls expireDue and publishes WORKER_EXPIRY payload when seats are freed", async () => {
    const eventId = "22222222-2222-4222-8222-222222222222";
    const freedSeats = ["SEC1-A-1", "SEC1-A-2"];
    mockRedis.scan.mockResolvedValueOnce(["0", [`hold_expiry:{${eventId}}`]]);
    mockRedisScripts.expireDue.mockResolvedValueOnce(freedSeats);

    const result = await service.processExpiredHolds(2_000_000);

    expect(result).toEqual({ [eventId]: freedSeats });
    expect(mockRedis.publish).toHaveBeenCalledWith(
      `seat-updates:${eventId}`,
      JSON.stringify({
        eventId,
        seatIds: freedSeats,
        state: "AVAILABLE",
        source: "WORKER_EXPIRY",
      }),
    );
    expect(service.getMetrics().seatsReleasedTotal).toBe(2);
  });

  it("continues processing remaining events if one event throws", async () => {
    const event1 = "33333333-3333-4333-8333-333333333333";
    const event2 = "44444444-4444-4444-8444-444444444444";
    mockRedis.scan.mockResolvedValueOnce([
      "0",
      [`hold_expiry:{${event1}}`, `hold_expiry:{${event2}}`],
    ]);
    mockRedisScripts.expireDue
      .mockRejectedValueOnce(new Error("Redis timeout"))
      .mockResolvedValueOnce(["VIP-1-1"]);

    const result = await service.processExpiredHolds(3_000_000);

    expect(result).toEqual({ [event2]: ["VIP-1-1"] });
    expect(mockRedis.publish).toHaveBeenCalledTimes(1);
    expect(service.getMetrics().errorsByStage.lua).toBe(1);
  });

  it("syncs event_seats to AVAILABLE in Postgres when DataSource is initialized", async () => {
    const eventId = "55555555-5555-4555-8555-555555555555";
    mockDataSource.isInitialized = true;
    mockRedis.scan.mockResolvedValueOnce(["0", [`hold_expiry:{${eventId}}`]]);
    mockRedisScripts.expireDue.mockResolvedValueOnce(["SEC2-B-3"]);

    await service.processExpiredHolds(4_000_000);

    expect(mockDataSource.getRepository).toHaveBeenCalledTimes(1);
    expect(mockQueryBuilder.set).toHaveBeenCalledWith({ status: "AVAILABLE" });
    expect(mockQueryBuilder.execute).toHaveBeenCalledTimes(1);
  });

  it("does not fail if optional Postgres sync throws", async () => {
    const eventId = "66666666-6666-4666-8666-666666666666";
    mockDataSource.isInitialized = true;
    mockQueryBuilder.execute.mockRejectedValueOnce(new Error("DB offline"));
    mockRedis.scan.mockResolvedValueOnce(["0", [`hold_expiry:{${eventId}}`]]);
    mockRedisScripts.expireDue.mockResolvedValueOnce(["SEC3-C-4"]);

    const result = await service.processExpiredHolds(5_000_000);

    expect(result).toEqual({ [eventId]: ["SEC3-C-4"] });
    expect(mockRedis.publish).toHaveBeenCalledTimes(1);
    expect(service.getMetrics().errorsByStage.db).toBe(1);
  });

  it("acquires distributed leader lock in handleCron and releases it atomically", async () => {
    await service.handleCron();

    expect(mockRedis.set).toHaveBeenCalledWith(
      "worker:expiry:leader",
      expect.any(String),
      "PX",
      4500,
      "NX",
    );
    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
    expect(service.getMetrics().ticksTotal).toBe(1);
    expect(service.getMetrics().ticksSkippedLock).toBe(0);
  });

  it("skips tick when another worker replica holds the distributed leader lock", async () => {
    mockRedis.set.mockResolvedValueOnce(null);

    await service.handleCron();

    expect(mockRedis.scan).not.toHaveBeenCalled();
    expect(mockRedis.eval).not.toHaveBeenCalled();
    expect(service.getMetrics().ticksSkippedLock).toBe(1);
  });

  it("suppresses overlapping handleCron ticks and drains on onModuleDestroy", async () => {
    let releaseScan!: (value: [string, string[]]) => void;
    mockRedis.scan.mockImplementationOnce(
      () =>
        new Promise<[string, string[]]>((resolve) => {
          releaseScan = resolve;
        }),
    );

    const firstTick = service.handleCron();
    // Yield microtask so firstTick reaches scan
    await Promise.resolve();
    await Promise.resolve();

    // Second tick should be skipped due to isRunning overlap guard
    await service.handleCron();
    expect(service.getMetrics().ticksSkippedOverlap).toBe(1);

    // Start shutdown drain while firstTick is still in flight
    let drained = false;
    const drainPromise = service.onModuleDestroy().then(() => {
      drained = true;
    });
    await Promise.resolve();
    expect(drained).toBe(false);

    releaseScan(["0", []]);
    await firstTick;
    await drainPromise;
    expect(drained).toBe(true);
  });
});
