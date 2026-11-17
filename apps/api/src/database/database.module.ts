import { Global, Module, OnModuleDestroy } from "@nestjs/common";
import { AppDataSource, Venue, Event, EventSeat } from "@urticketbuddy/db";
import { loadEnv } from "@urticketbuddy/config";
import mongoose from "mongoose";
import { DataSource } from "typeorm";
import { VenueLayoutModel } from "../modules/venues/schemas/venue-layout.schema";
import {
  DATA_SOURCE,
  VENUE_REPOSITORY,
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  MONGO_CONNECTION,
  VENUE_LAYOUT_MODEL,
} from "./database.tokens";

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
              "Warning: AppDataSource failed to connect: " +
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
      provide: MONGO_CONNECTION,
      useFactory: async () => {
        const env = loadEnv();
        if (mongoose.connection.readyState === 0) {
          try {
            await mongoose.connect(env.MONGO_URI);
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
  ],
  exports: [
    DATA_SOURCE,
    VENUE_REPOSITORY,
    EVENT_REPOSITORY,
    EVENT_SEAT_REPOSITORY,
    MONGO_CONNECTION,
    VENUE_LAYOUT_MODEL,
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
  }
}
