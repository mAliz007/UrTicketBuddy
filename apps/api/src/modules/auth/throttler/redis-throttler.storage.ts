import { Inject, Injectable, Optional } from "@nestjs/common";
import { ThrottlerStorage } from "@nestjs/throttler";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../../../database/database.tokens";

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Redis-backed ThrottlerStorage implementation using the AGENTS.md Section 7 key format:
 * rate:<route>:<key>
 * Gracefully falls back to in-memory counters when Redis is mocked or disconnected in isolated unit tests.
 */
@Injectable()
export class RedisThrottlerStorageService implements ThrottlerStorage {
  private readonly fallbackStore = new Map<
    string,
    { hits: number; expiresAt: number }
  >();

  constructor(
    @Optional()
    @Inject(REDIS_CLIENT)
    private readonly redis?: Redis,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const ttlMs = ttl > 0 ? ttl : 60_000;
    const redisKey = `rate:${throttlerName || "default"}:${key}`;

    if (
      this.redis &&
      this.redis.status === "ready" &&
      typeof this.redis.incr === "function"
    ) {
      try {
        const totalHits = await this.redis.incr(redisKey);
        if (totalHits === 1 && typeof this.redis.pexpire === "function") {
          await this.redis.pexpire(redisKey, ttlMs);
        }
        let pttl = ttlMs;
        if (typeof this.redis.pttl === "function") {
          const rawPttl = await this.redis.pttl(redisKey);
          if (typeof rawPttl === "number" && rawPttl > 0) {
            pttl = rawPttl;
          }
        }
        const isBlocked = totalHits > limit;
        const timeToExpire = Math.ceil(pttl / 1000);
        return {
          totalHits,
          timeToExpire,
          isBlocked,
          timeToBlockExpire: isBlocked
            ? Math.ceil((blockDuration || ttlMs) / 1000)
            : 0,
        };
      } catch {
        // Fall through to in-memory counter if Redis command fails
      }
    }

    const now = Date.now();
    const existing = this.fallbackStore.get(redisKey);
    if (!existing || existing.expiresAt <= now) {
      const expiresAt = now + ttlMs;
      this.fallbackStore.set(redisKey, { hits: 1, expiresAt });
      return {
        totalHits: 1,
        timeToExpire: Math.ceil(ttlMs / 1000),
        isBlocked: 1 > limit,
        timeToBlockExpire: 0,
      };
    }

    existing.hits += 1;
    const remainingMs = Math.max(1000, existing.expiresAt - now);
    const isBlocked = existing.hits > limit;
    return {
      totalHits: existing.hits,
      timeToExpire: Math.ceil(remainingMs / 1000),
      isBlocked,
      timeToBlockExpire: isBlocked
        ? Math.ceil((blockDuration || remainingMs) / 1000)
        : 0,
    };
  }
}
