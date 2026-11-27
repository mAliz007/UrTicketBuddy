import { Global, Module, OnModuleDestroy } from "@nestjs/common";
import {
  AppDataSource,
  Venue,
  Event,
  EventSeat,
  TicketTier,
  Order,
  OrderItem,
  User,
  RefreshToken,
  Ticket,
  GateScan,
  ResaleListing,
  LedgerEntry,
  PlatformSetting,
  AuditLog,
} from "@urticketbuddy/db";
import { loadEnv } from "@urticketbuddy/config";
import mongoose from "mongoose";
import { DataSource } from "typeorm";
import Redis from "ioredis";
import { RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";
import { VenueLayoutModel } from "../modules/venues/schemas/venue-layout.schema";
import {
  DATA_SOURCE,
  VENUE_REPOSITORY,
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  TICKET_TIER_REPOSITORY,
  USER_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  ORDER_REPOSITORY,
  ORDER_ITEM_REPOSITORY,
  TICKET_REPOSITORY,
  GATE_SCAN_REPOSITORY,
  RESALE_LISTING_REPOSITORY,
  LEDGER_ENTRY_REPOSITORY,
  PLATFORM_SETTING_REPOSITORY,
  AUDIT_LOG_REPOSITORY,
  MONGO_CONNECTION,
  VENUE_LAYOUT_MODEL,
  REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
} from "./database.tokens";

let redisClientInstance: Redis | null = null;

@Global()
@Module({
  providers: [
    {
      provide: DATA_SOURCE,
      useFactory: async (): Promise<DataSource> => {
        if (!AppDataSource.isInitialized) {
          try {
            await AppDataSource.initialize();
          } catch (err) {
            console.warn(
              "Warning: TypeORM failed to initialize database connection: " +
                (err instanceof Error ? err.message : String(err)),
            );
          }
        }
        return AppDataSource;
      },
    },
    {
      provide: VENUE_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(Venue);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: EVENT_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(Event);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: EVENT_SEAT_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(EventSeat);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: TICKET_TIER_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(TicketTier);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: USER_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(User);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(RefreshToken);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: ORDER_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(Order);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: ORDER_ITEM_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(OrderItem);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: TICKET_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(Ticket);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: GATE_SCAN_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(GateScan);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: RESALE_LISTING_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(ResaleListing);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: LEDGER_ENTRY_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(LedgerEntry);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: PLATFORM_SETTING_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        return dataSource.getRepository(PlatformSetting);
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: AUDIT_LOG_REPOSITORY,
      useFactory: (dataSource: DataSource) => {
        const repo = dataSource.getRepository(AuditLog);
        const forbiddenMutation = () => {
          throw new Error(
            "audit_logs table is append-only and cannot be updated or deleted",
          );
        };
        return new Proxy(repo, {
          get(target, prop, receiver) {
            if (
              prop === "update" ||
              prop === "delete" ||
              prop === "remove" ||
              prop === "softDelete" ||
              prop === "clear"
            ) {
              return forbiddenMutation;
            }
            return Reflect.get(target, prop, receiver);
          },
        });
      },
      inject: [DATA_SOURCE],
    },
    {
      provide: MONGO_CONNECTION,
      useFactory: async () => {
        const env = loadEnv();
        if (mongoose.connection.readyState === 0) {
          try {
            await mongoose.connect(env.MONGO_URI, {
              serverSelectionTimeoutMS: 3000,
              connectTimeoutMS: 3000,
            });
          } catch (err) {
            console.warn(
              "Warning: MongoDB failed to connect: " +
                (err instanceof Error ? err.message : String(err)),
            );
          }
        }
        return mongoose.connection;
      },
    },
    {
      provide: VENUE_LAYOUT_MODEL,
      useFactory: () => {
        return VenueLayoutModel;
      },
    },
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const env = loadEnv();
        if (!redisClientInstance) {
          redisClientInstance = new Redis({
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null,
          });
          redisClientInstance.on("error", () => {
            // Suppress unhandled redis connection errors in offline/test envs
          });
        }
        return redisClientInstance;
      },
    },
    {
      provide: REDIS_SCRIPTS_WRAPPER,
      useFactory: (redisClient: Redis) => {
        return new RedisScriptsWrapper(redisClient);
      },
      inject: [REDIS_CLIENT],
    },
  ],
  exports: [
    DATA_SOURCE,
    VENUE_REPOSITORY,
    EVENT_REPOSITORY,
    EVENT_SEAT_REPOSITORY,
    TICKET_TIER_REPOSITORY,
    ORDER_REPOSITORY,
    ORDER_ITEM_REPOSITORY,
    USER_REPOSITORY,
    REFRESH_TOKEN_REPOSITORY,
    TICKET_REPOSITORY,
    GATE_SCAN_REPOSITORY,
    RESALE_LISTING_REPOSITORY,
    LEDGER_ENTRY_REPOSITORY,
    PLATFORM_SETTING_REPOSITORY,
    AUDIT_LOG_REPOSITORY,
    MONGO_CONNECTION,
    VENUE_LAYOUT_MODEL,
    REDIS_CLIENT,
    REDIS_SCRIPTS_WRAPPER,
  ],
})
export class DatabaseModule implements OnModuleDestroy {
  async onModuleDestroy() {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (redisClientInstance && redisClientInstance.status === "ready") {
      await redisClientInstance.quit();
      redisClientInstance = null;
    }
  }
}
