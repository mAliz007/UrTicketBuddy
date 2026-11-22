import {
  Injectable,
  Inject,
  Logger,
  OnApplicationBootstrap,
  Optional,
} from "@nestjs/common";
import Redis from "ioredis";
import { Repository } from "typeorm";
import { Ticket } from "@urticketbuddy/db";
import {
  REDIS_CLIENT,
  TICKET_REPOSITORY,
} from "../../database/database.tokens";

/**
 * BloomService manages the high-throughput RedisBloom ticket prefilter (key: `bf:tickets`).
 *
 * ARCHITECTURAL INVARIANT (D-7 & Section 7):
 * - The Bloom filter is a prefilter ONLY: it is used to reject definite non-existent/forged
 *   tokens with O(1) time complexity without querying PostgreSQL.
 * - It NEVER approves a scan; candidate scans that pass the Bloom filter MUST still be
 *   verified against PostgreSQL, tenant boundaries, and the Redis replay nonce lock.
 * - If RedisBloom commands (BF.ADD / BF.EXISTS) are unavailable (e.g. in test/offline environments),
 *   it falls back gracefully to a Redis SET (`bf:tickets:fallback`), and finally to an in-memory Set.
 */
@Injectable()
export class BloomService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BloomService.name);
  public static readonly BLOOM_KEY = "bf:tickets";
  public static readonly FALLBACK_KEY = "bf:tickets:fallback";
  private isBloomAvailable = true;
  private isWarming = false;
  private readonly inMemoryFallback = new Set<string>();

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redisClient: Redis,
    @Optional()
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepository?: Repository<Ticket>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.initAndRebuild();
  }

  /**
   * Rebuilds or warms the Bloom filter from PostgreSQL tickets on startup
   * using cursor pagination and pipelined batching for optimal memory and throughput.
   */
  async initAndRebuild(): Promise<void> {
    if (this.isWarming) {
      return;
    }
    this.isWarming = true;
    try {
      if (!this.ticketRepository) {
        return;
      }

      const chunkSize = 2000;
      let offset = 0;
      let totalWarmed = 0;

      while (true) {
        const tickets = await this.ticketRepository.find({
          select: ["id"],
          skip: offset,
          take: chunkSize,
        });

        if (!tickets || tickets.length === 0) {
          break;
        }

        // Pipelined RedisBloom batch insertion
        if (
          this.isBloomAvailable &&
          this.redisClient &&
          typeof (this.redisClient as any).pipeline === "function"
        ) {
          try {
            const pipeline = this.redisClient.pipeline();
            for (const ticket of tickets) {
              (pipeline as any).call(
                "BF.ADD",
                BloomService.BLOOM_KEY,
                ticket.id,
              );
            }
            await pipeline.exec();
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            if (
              msg.includes("unknown command") ||
              msg.includes("ERR unknown")
            ) {
              this.isBloomAvailable = false;
            }
          }
        }

        // Fallback Redis SET batch insertion
        if (
          !this.isBloomAvailable &&
          this.redisClient &&
          typeof this.redisClient.sadd === "function"
        ) {
          try {
            const ids = tickets.map((t) => t.id);
            await this.redisClient.sadd(BloomService.FALLBACK_KEY, ...ids);
          } catch {
            // Proceed to in-memory fallback
          }
        }

        // In-memory set warming
        for (const ticket of tickets) {
          this.inMemoryFallback.add(ticket.id);
        }

        totalWarmed += tickets.length;
        offset += tickets.length;
        if (tickets.length < chunkSize) {
          break;
        }
      }

      this.logger.log(
        `Warmed RedisBloom ticket prefilter with ${totalWarmed} tickets.`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to warm Bloom filter on startup: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Adds a ticketId to the RedisBloom prefilter.
   */
  async add(ticketId: string): Promise<boolean> {
    if (
      this.isBloomAvailable &&
      this.redisClient &&
      typeof (this.redisClient as any).call === "function"
    ) {
      try {
        const res = await (this.redisClient as any).call(
          "BF.ADD",
          BloomService.BLOOM_KEY,
          ticketId,
        );
        return res === 1;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("unknown command") || msg.includes("ERR unknown")) {
          this.isBloomAvailable = false;
        } else {
          this.logger.error(`Error adding to RedisBloom: ${msg}`);
        }
      }
    }

    if (this.redisClient && typeof this.redisClient.sadd === "function") {
      try {
        await this.redisClient.sadd(BloomService.FALLBACK_KEY, ticketId);
        return true;
      } catch (fallbackErr) {
        this.logger.error(
          `Error adding to fallback SET: ${
            fallbackErr instanceof Error
              ? fallbackErr.message
              : String(fallbackErr)
          }`,
        );
      }
    }

    this.inMemoryFallback.add(ticketId);
    return true;
  }

  /**
   * Checks if a ticketId might exist.
   * Returns false if DEFINITELY NOT in the set (zero false negatives).
   * Returns true if possibly in the set (subject to false positive rate).
   */
  async mightExist(ticketId: string): Promise<boolean> {
    if (
      this.isBloomAvailable &&
      this.redisClient &&
      typeof (this.redisClient as any).call === "function"
    ) {
      try {
        if (typeof this.redisClient.exists === "function") {
          const keyExists = await this.redisClient.exists(
            BloomService.BLOOM_KEY,
          );
          if (!keyExists) {
            // Bloom key is uninitialized or Redis was restarted/flushed
            // Fail open to avoid rejecting valid patrons, and trigger background warming
            if (!this.isWarming) {
              this.logger.warn(
                `RedisBloom key '${BloomService.BLOOM_KEY}' missing; failing open and triggering re-warming.`,
              );
              this.initAndRebuild().catch((err) =>
                this.logger.error(
                  `Background warming failed: ${
                    err instanceof Error ? err.message : String(err)
                  }`,
                ),
              );
            }
            return true;
          }
        }

        const res = await (this.redisClient as any).call(
          "BF.EXISTS",
          BloomService.BLOOM_KEY,
          ticketId,
        );
        return res === 1;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("unknown command") || msg.includes("ERR unknown")) {
          this.isBloomAvailable = false;
        } else {
          this.logger.error(`Error checking RedisBloom: ${msg}`);
        }
      }
    }

    if (this.redisClient && typeof this.redisClient.sismember === "function") {
      try {
        if (typeof this.redisClient.exists === "function") {
          const keyExists = await this.redisClient.exists(
            BloomService.FALLBACK_KEY,
          );
          if (!keyExists) {
            if (!this.isWarming) {
              this.initAndRebuild().catch(() => {});
            }
            return true;
          }
        }

        const exists = await this.redisClient.sismember(
          BloomService.FALLBACK_KEY,
          ticketId,
        );
        return exists === 1;
      } catch (fallbackErr) {
        this.logger.error(
          `Error checking fallback SET: ${
            fallbackErr instanceof Error
              ? fallbackErr.message
              : String(fallbackErr)
          }`,
        );
      }
    }

    // In-memory fallback
    return (
      this.inMemoryFallback.size === 0 || this.inMemoryFallback.has(ticketId)
    );
  }
}
