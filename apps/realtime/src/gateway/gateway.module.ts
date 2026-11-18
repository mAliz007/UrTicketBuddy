import { Logger, Module } from "@nestjs/common";
import { loadEnv } from "@urticketbuddy/config";
import Redis from "ioredis";
import { REALTIME_REDIS_SUBSCRIBER } from "./gateway.tokens";
import { SeatUpdatesGateway } from "./seat-updates.gateway";

@Module({
  providers: [
    {
      provide: REALTIME_REDIS_SUBSCRIBER,
      useFactory: () => {
        const env = loadEnv();
        const logger = new Logger("RealtimeRedisSubscriber");
        const client = new Redis({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          password: env.REDIS_PASSWORD || undefined,
          lazyConnect: true,
        });
        client.on("error", (err) => {
          logger.warn(`Redis subscriber error: ${err.message}`);
        });
        return client;
      },
    },
    SeatUpdatesGateway,
  ],
  exports: [SeatUpdatesGateway, REALTIME_REDIS_SUBSCRIBER],
})
export class GatewayModule {}
