import { Inject, Logger, Module, OnModuleDestroy } from "@nestjs/common";
import { loadEnv } from "@urticketbuddy/config";
import { RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";
import Redis from "ioredis";
import {
  CheckoutController,
  EventSeatsHoldController,
} from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import {
  CHECKOUT_REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
} from "./checkout.tokens";

@Module({
  controllers: [CheckoutController, EventSeatsHoldController],
  providers: [
    {
      provide: CHECKOUT_REDIS_CLIENT,
      useFactory: () => {
        const env = loadEnv();
        const logger = new Logger("CheckoutRedis");
        const client = new Redis({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD || undefined,
          lazyConnect: true,
        });
        client.on("error", (err) => {
          logger.warn(`Redis client error: ${err.message}`);
        });
        return client;
      },
    },
    {
      provide: REDIS_SCRIPTS_WRAPPER,
      useFactory: (redis: Redis) => new RedisScriptsWrapper(redis),
      inject: [CHECKOUT_REDIS_CLIENT],
    },
    CheckoutService,
  ],
  exports: [CheckoutService, CHECKOUT_REDIS_CLIENT, REDIS_SCRIPTS_WRAPPER],
})
export class CheckoutModule implements OnModuleDestroy {
  constructor(
    @Inject(CHECKOUT_REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.redis && typeof this.redis.quit === "function") {
      try {
        await this.redis.quit();
      } catch {
        this.redis.disconnect?.();
      }
    }
  }
}
