import "reflect-metadata";
import { DataSource } from "typeorm";
import { loadEnv } from "@urticketbuddy/config";
import { Venue } from "./entities/venue.entity";
import { Event } from "./entities/event.entity";
import { EventSeat } from "./entities/event-seat.entity";
import { Order } from "./entities/order.entity";
import { OrderItem } from "./entities/order-item.entity";
import { User } from "./entities/user.entity";
import { RefreshToken } from "./entities/refresh-token.entity";
import { Ticket } from "./entities/ticket.entity";
import { GateScan } from "./entities/gate-scan.entity";
import { ResaleListing } from "./entities/resale-listing.entity";
import { LedgerEntry } from "./entities/ledger-entry.entity";
import { PlatformSetting } from "./entities/platform-setting.entity";
import { AuditLog } from "./entities/audit-log.entity";

const env = loadEnv();

const useSsl =
  Boolean(env.POSTGRES_SSL) ||
  process.env.POSTGRES_SSL === "true" ||
  Boolean(env.POSTGRES_HOST?.includes("neon.tech"));

export const AppDataSource = new DataSource({
  type: "postgres",
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  username: env.POSTGRES_USER,
  password: env.POSTGRES_PASSWORD,
  database: env.POSTGRES_DB,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging: env.NODE_ENV === "development",
  entities: [
    Venue,
    Event,
    EventSeat,
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
    __dirname + "/entities/**/!(*.spec|*.test).{js,ts}",
  ],
  migrations: [__dirname + "/migrations/**/!(*.spec|*.test).{js,ts}"],
  migrationsTableName: "migrations",
  subscribers: [],
});
