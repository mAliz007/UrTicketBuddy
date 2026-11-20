import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { EventSeat } from "@urticketbuddy/db";
import { RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";
import Redis from "ioredis";
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

const HOLD_EXPIRY_KEY_PATTERN = "hold_expiry:{*}";
const HOLD_EXPIRY_KEY_REGEX = /^hold_expiry:\{([^}]+)\}$/;
const SCAN_COUNT = 100;

@Injectable()
export class ExpiryService {
  private readonly logger = new Logger(ExpiryService.name);
  private isRunning = false;

  constructor(
    @Inject(WORKER_REDIS_CLIENT) private readonly redis: Redis,
    @Inject(WORKER_REDIS_SCRIPTS)
    private readonly redisScripts: RedisScriptsWrapper,
    @Optional()
    @Inject(WORKER_DATA_SOURCE)
    private readonly dataSource?: DataSource | null,
  ) {}

  @Cron("*/5 * * * * *")
  async handleCron(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug("Skipping expiry cron tick; previous run still active");
      return;
    }

    this.isRunning = true;
    try {
      await this.processExpiredHolds();
    } catch (err) {
      this.logger.error(
        `Unexpected error during hold expiry cron: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      this.isRunning = false;
    }
  }

  async processExpiredHolds(
    nowMs: number = Date.now(),
  ): Promise<Record<string, string[]>> {
    const activeEventIds = await this.getActiveEventIds();
    const releasedByEvent: Record<string, string[]> = {};

    for (const eventId of activeEventIds) {
      try {
        const freedSeatIds = await this.redisScripts.expireDue(eventId, nowMs);
        if (freedSeatIds.length === 0) {
          continue;
        }

        releasedByEvent[eventId] = freedSeatIds;
        this.logger.log(
          `Released ${freedSeatIds.length} expired seat(s) for event ${eventId}: ${freedSeatIds.join(", ")}`,
        );

        await this.publishSeatUpdates(eventId, freedSeatIds);
        await this.syncPostgresSeats(eventId, freedSeatIds);
      } catch (err) {
        this.logger.error(
          `Failed to process hold expiry for event ${eventId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return releasedByEvent;
  }

  async getActiveEventIds(): Promise<string[]> {
    const eventIds = new Set<string>();
    let cursor = "0";

    do {
      const [nextCursor, keys] = await this.redis.scan(
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

    return Array.from(eventIds);
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

    await this.redis.publish(
      `seat-updates:${eventId}`,
      JSON.stringify(payload),
    );
  }

  private async syncPostgresSeats(
    eventId: string,
    seatIds: string[],
  ): Promise<void> {
    if (!this.dataSource?.isInitialized || seatIds.length === 0) {
      return;
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
      this.logger.warn(
        `Optional PostgreSQL sync failed for event ${eventId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
