import "reflect-metadata";
import { DataSource } from "typeorm";
import { loadEnv } from "@urticketbuddy/config";
import { Venue } from "./entities/venue.entity";
import { Event } from "./entities/event.entity";
import { EventSeat } from "./entities/event-seat.entity";
import { User } from "./entities/user.entity";

const env = loadEnv();

export const AppDataSource = new DataSource({
  type: "postgres",
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  username: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
  synchronize: false,
  logging: env.NODE_ENV === "development",
  entities: [
    Venue,
    Event,
    EventSeat,
    User,
    __dirname + "/entities/**/!(*.spec|*.test).{js,ts}",
  ],
  migrations: [__dirname + "/migrations/**/!(*.spec|*.test).{js,ts}"],
  migrationsTableName: "migrations",
  subscribers: [],
});
