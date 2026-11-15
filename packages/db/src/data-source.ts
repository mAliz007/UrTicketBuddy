import "reflect-metadata";
import { DataSource } from "typeorm";
import { loadEnv } from "@urticketbuddy/config";

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
  entities: [__dirname + "/entities/**/*.{js,ts}"],
  migrations: [__dirname + "/migrations/**/*.{js,ts}"],
  subscribers: [],
});
