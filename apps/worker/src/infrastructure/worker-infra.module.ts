import {
  Global,
  Inject,
  Logger,
  Module,
  OnModuleDestroy,
} from "@nestjs/common";
import { loadEnv } from "@urticketbuddy/config";
import { AppDataSource } from "@urticketbuddy/db";
import { RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";
import Redis from "ioredis";
import { DataSource } from "typeorm";
import {
  WORKER_DATA_SOURCE,
  WORKER_REDIS_CLIENT,
  WORKER_REDIS_SCRIPTS,
} from "./worker-infra.tokens";

@Global()
@Module({
  providers: [
    {
      provide: WORKER_REDIS_CLIENT,
      useFactory: (): Redis => {
        const env = loadEnv();
        const logger = new Logger("WorkerRedisClient");
        const client = new Redis({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD || undefined,
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => Math.min(times * 200, 5000),
        });
        client.on("error", (err) => {
          logger.warn(`Redis connection error: ${err.message}`);
        });
        return client;
      },
    },
    {
      provide: WORKER_REDIS_SCRIPTS,
      useFactory: (redis: Redis): RedisScriptsWrapper => {
        return new RedisScriptsWrapper(redis);
      },
      inject: [WORKER_REDIS_CLIENT],
    },
    {
      provide: WORKER_DATA_SOURCE,
      useFactory: async (): Promise<DataSource | null> => {
        const logger = new Logger("WorkerDataSource");
        try {
          if (!AppDataSource.isInitialized) {
            await AppDataSource.initialize();
          }
          return AppDataSource;
        } catch (err) {
          logger.warn(
            `PostgreSQL connection deferred (DB sync disabled until available): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          return null;
        }
      },
    },
  ],
  exports: [WORKER_REDIS_CLIENT, WORKER_REDIS_SCRIPTS, WORKER_DATA_SOURCE],
})
export class WorkerInfraModule implements OnModuleDestroy {
  constructor(
    @Inject(WORKER_REDIS_CLIENT) private readonly redis: Redis,
    @Inject(WORKER_DATA_SOURCE) private readonly dataSource: DataSource | null,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis && this.redis.status !== "end") {
      await this.redis.quit().catch(() => undefined);
    }
    if (this.dataSource?.isInitialized) {
      await this.dataSource.destroy().catch(() => undefined);
    }
  }
}
