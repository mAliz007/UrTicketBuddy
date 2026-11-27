import { randomUUID } from "crypto";
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  Optional,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { EventSeat } from "@urticketbuddy/db";
import { RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";
import Redis, { Cluster } from "ioredis";
import { DataSource } from "typeorm";
import {
  WORKER_DATA_SOURCE,
  WORKER_REDIS_CLIENT,
  WORKER_REDIS_SCRIPTS,
} from "../../infrastructure/worker-infra.tokens";

export interface SeatExpiryPubSubPayload {
  eventId: string;
  seatIds: string[];
  state: "AVAILABLE";
  source: "WORKER_EXPIRY";
}

export interface ExpiryMetrics {
  ticksTotal: number;
  ticksSkippedOverlap: number;
  ticksSkippedLock: number;
  seatsReleasedTotal: number;
  lastTickDurationMs: number;
  errorsByStage: {
    lock: number;
    scan: number;
    lua: number;
    pubsub: number;
    db: number;
  };
}

const HOLD_EXPIRY_KEY_PATTERN = "hold_expiry:{*}";
const HOLD_EXPIRY_KEY_REGEX = /^hold_expiry:\{([^}]+)\}$/;
const LEADER_LOCK_KEY = "worker:expiry:leader";
const LEADER_LEASE_MS = 900;
const TICK_WARN_THRESHOLD_MS = 4000;
const SCAN_COUNT = 100;
const EVENT_CONCURRENCY = 10;
const DB_RECONNECT_COOLDOWN_MS = 30_000;

const RELEASE_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

@Injectable()
export class ExpiryService implements OnModuleDestroy {
  private readonly logger = new Logger(ExpiryService.name);
  private readonly instanceId = randomUUID();
  private isRunning = false;
  private isShuttingDown = false;
  private inFlightTick: Promise<void> | null = null;
  private lastDbInitAttemptMs = 0;

  private readonly metrics: ExpiryMetrics = {
    ticksTotal: 0,
    ticksSkippedOverlap: 0,
    ticksSkippedLock: 0,
    seatsReleasedTotal: 0,
    lastTickDurationMs: 0,
    errorsByStage: {
      lock: 0,
      scan: 0,
      lua: 0,
      pubsub: 0,
      db: 0,
    },
  };

  constructor(
    @Inject(WORKER_REDIS_CLIENT) private readonly redis: Redis | Cluster,
    @Inject(WORKER_REDIS_SCRIPTS)
    private readonly redisScripts: RedisScriptsWrapper,
    @Optional()
    @Inject(WORKER_DATA_SOURCE)
    private readonly dataSource?: DataSource | null,
  ) {}

  getMetrics(): ExpiryMetrics {
    return {
      ...this.metrics,
      errorsByStage: { ...this.metrics.errorsByStage },
    };
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    if (this.inFlightTick) {
      this.logger.log("Draining in-flight hold expiry tick before shutdown...");
      await this.inFlightTick;
    }
  }

  @Cron("*/1 * * * * *")
  async handleCron(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    if (this.isRunning) {
      this.metrics.ticksSkippedOverlap += 1;
      this.logger.warn(
        "Skipping expiry cron tick; previous run still active (possible backlog)",
      );
      return;
    }

    this.isRunning = true;
    const tickPromise = this.runDistributedTick();
    this.inFlightTick = tickPromise;

    try {
      await tickPromise;
    } finally {
      this.inFlightTick = null;
      this.isRunning = false;
    }
  }

  private async runDistributedTick(): Promise<void> {
    const startMs = Date.now();
    this.metrics.ticksTotal += 1;

    let acquired = false;
    try {
      const lockRes = await this.redis.set(
        LEADER_LOCK_KEY,
        this.instanceId,
        "PX",
        LEADER_LEASE_MS,
        "NX",
      );
      acquired = lockRes === "OK";
    } catch (err) {
      this.metrics.errorsByStage.lock += 1;
      this.logger.error(
        `Failed to acquire expiry leader lock: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return;
    }

    if (!acquired) {
      this.metrics.ticksSkippedLock += 1;
      return;
    }

    try {
      await this.processExpiredHolds(0);
    } catch (err) {
      this.logger.error(
        `Unexpected error during hold expiry cron: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      const durationMs = Date.now() - startMs;
      this.metrics.lastTickDurationMs = durationMs;
      if (durationMs > TICK_WARN_THRESHOLD_MS) {
        this.logger.warn(
          `Hold expiry tick took ${durationMs}ms (exceeds ${TICK_WARN_THRESHOLD_MS}ms budget)`,
        );
      }

      try {
        await this.redis.eval(
          RELEASE_LOCK_LUA,
          1,
          LEADER_LOCK_KEY,
          this.instanceId,
        );
      } catch (err) {
        this.metrics.errorsByStage.lock += 1;
        this.logger.warn(
          `Failed to release expiry leader lock: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  async processExpiredHolds(
    nowMs: number = 0,
  ): Promise<Record<string, string[]>> {
    let activeEventIds: string[];
    try {
      activeEventIds = await this.getActiveEventIds();
    } catch (err) {
      this.metrics.errorsByStage.scan += 1;
      throw err;
    }

    const releasedByEvent: Record<string, string[]> = {};

    for (let i = 0; i < activeEventIds.length; i += EVENT_CONCURRENCY) {
      if (this.isShuttingDown) {
        break;
      }

      const batch = activeEventIds.slice(i, i + EVENT_CONCURRENCY);
      await Promise.all(
        batch.map(async (eventId) => {
          await this.processSingleEvent(eventId, nowMs, releasedByEvent);
        }),
      );
    }

    return releasedByEvent;
  }

  private async processSingleEvent(
    eventId: string,
    nowMs: number,
    releasedByEvent: Record<string, string[]>,
  ): Promise<void> {
    let freedSeatIds: string[];
    try {
      freedSeatIds = await this.redisScripts.expireDue(eventId, nowMs);
    } catch (err) {
      this.metrics.errorsByStage.lua += 1;
      this.logger.error(
        `Failed to execute expireDue for event ${eventId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return;
    }

    if (freedSeatIds.length === 0) {
      return;
    }

    releasedByEvent[eventId] = freedSeatIds;
    this.metrics.seatsReleasedTotal += freedSeatIds.length;
    this.logger.log(
      `Released ${freedSeatIds.length} expired seat(s) for event ${eventId}: ${freedSeatIds.join(", ")}`,
    );

    try {
      await this.publishSeatUpdates(eventId, freedSeatIds);
    } catch (err) {
      this.metrics.errorsByStage.pubsub += 1;
      this.logger.error(
        `Failed to publish seat-updates for event ${eventId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    await this.syncPostgresSeats(eventId, freedSeatIds);
  }

  async getActiveEventIds(): Promise<string[]> {
    const eventIds = new Set<string>();
    const nodes = this.getScanNodes();

    for (const node of nodes) {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await node.scan(
          cursor,
          "MATCH",
          HOLD_EXPIRY_KEY_PATTERN,
          "COUNT",
          SCAN_COUNT,
        );
        cursor = nextCursor;

        for (const key of keys) {
          const match = HOLD_EXPIRY_KEY_REGEX.exec(key);
          if (match?.[1]) {
            eventIds.add(match[1]);
          }
        }
      } while (cursor !== "0");
    }

    return Array.from(eventIds);
  }

  private getScanNodes(): Redis[] {
    const maybeCluster = this.redis as Partial<Cluster>;
    if (typeof maybeCluster.nodes === "function") {
      return maybeCluster.nodes("master");
    }
    return [this.redis as Redis];
  }

  private async publishSeatUpdates(
    eventId: string,
    seatIds: string[],
  ): Promise<void> {
    const payload: SeatExpiryPubSubPayload = {
      eventId,
      seatIds,
      state: "AVAILABLE",
      source: "WORKER_EXPIRY",
    };

    await this.redis.publish("seat.state", JSON.stringify(payload));
  }

  private async syncPostgresSeats(
    eventId: string,
    seatIds: string[],
  ): Promise<void> {
    if (!this.dataSource || seatIds.length === 0) {
      return;
    }

    if (!this.dataSource.isInitialized) {
      const now = Date.now();
      if (now - this.lastDbInitAttemptMs < DB_RECONNECT_COOLDOWN_MS) {
        return;
      }
      this.lastDbInitAttemptMs = now;
      try {
        await this.dataSource.initialize();
      } catch (err) {
        this.metrics.errorsByStage.db += 1;
        this.logger.warn(
          `Lazy PostgreSQL reconnect failed for event ${eventId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return;
      }
    }

    try {
      await this.dataSource
        .getRepository(EventSeat)
        .createQueryBuilder()
        .update(EventSeat)
        .set({ status: "AVAILABLE" })
        .where("eventId = :eventId", { eventId })
        .andWhere("seatId IN (:...seatIds)", { seatIds })
        .andWhere("status = :heldStatus", { heldStatus: "HELD" })
        .execute();
    } catch (err) {
      this.metrics.errorsByStage.db += 1;
      this.logger.warn(
        `Optional PostgreSQL sync failed for event ${eventId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
