import { z } from "zod";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  API_PORT: z.coerce.number().default(3000),
  REALTIME_PORT: z.coerce.number().default(3001),
  WORKER_PORT: z.coerce.number().default(3002),
  WEB_PORT: z.coerce.number().default(5173),

  // Database - Postgres (through PgBouncer 6432)
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().default(6432),
  POSTGRES_USER: z.string().default("postgres"),
  POSTGRES_PASSWORD: z.string().default("postgres"),
  POSTGRES_DB: z.string().default("urticketbuddy"),
  POSTGRES_DIRECT_PORT: z.coerce.number().default(5432),

  // MongoDB
  MONGO_URI: z.string().default("mongodb://localhost:27017/urticketbuddy"),

  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Elasticsearch
  ELASTICSEARCH_NODE: z.string().default("http://localhost:9200"),

  // Secrets & Auth
  JWT_SECRET: z
    .string()
    .min(16)
    .default("development-jwt-secret-min-16-characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default("development-jwt-refresh-secret-min-16"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  MASTER_TICKET_SECRET: z
    .string()
    .min(32)
    .default("dev-master-ticket-secret-32-chars-long-key"),

  // Payment Providers
  STRIPE_SECRET_KEY: z.string().optional(),
  SAFEPAY_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function loadEnv(overridePath?: string): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  let envFile = overridePath;
  if (!envFile) {
    const cwdEnv = path.resolve(process.cwd(), ".env");
    const rootEnv = path.resolve(__dirname, "../../../.env");
    if (fs.existsSync(cwdEnv)) {
      envFile = cwdEnv;
    } else if (fs.existsSync(rootEnv)) {
      envFile = rootEnv;
    } else {
      envFile = cwdEnv;
    }
  }

  dotenv.config({ path: envFile });

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorDetails = JSON.stringify(result.error.format(), null, 2);
    throw new Error(`Environment validation failed:\n${errorDetails}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}
