import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { loadEnv } from "@urticketbuddy/config";
import {
  AppDataSource,
  Event,
  EventSeat,
  User,
  Venue,
} from "@urticketbuddy/db";
import Redis from "ioredis";

export const LOADTEST_VENUE_ID = "d0000000-0000-4000-8000-000000001000";
export const LOADTEST_EVENT_ID = "e0000000-0000-4000-8000-000000001000";
export const LOADTEST_SEAT_ROWS = 50;
export const LOADTEST_SEAT_COLS = 100;
export const LOADTEST_TOTAL_SEATS = LOADTEST_SEAT_ROWS * LOADTEST_SEAT_COLS; // 5,000
export const LOADTEST_USER_COUNT = 1000;
export const TARGET_CONTENTION_SEAT = "SEC-A-1-1";

export interface LoadTestUserEntry {
  userId: string;
  email: string;
  role: string;
  token: string;
}

export interface LoadTestSeedManifest {
  venueId: string;
  eventId: string;
  seatCount: number;
  targetSeatId: string;
  generatedAt: string;
  users: LoadTestUserEntry[];
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signLoadTestJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 86_400,
): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    ...payload,
    iat: nowSec,
    exp: nowSec + expiresInSeconds,
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(body))}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest();
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export function generate5000SeatDefinitions(eventId: string): Array<{
  eventId: string;
  seatId: string;
  tierId: string;
  x: number;
  y: number;
  status: string;
}> {
  const seats: Array<{
    eventId: string;
    seatId: string;
    tierId: string;
    x: number;
    y: number;
    status: string;
  }> = [];

  for (let row = 1; row <= LOADTEST_SEAT_ROWS; row++) {
    for (let col = 1; col <= LOADTEST_SEAT_COLS; col++) {
      seats.push({
        eventId,
        seatId: `SEC-A-${row}-${col}`,
        tierId: row <= 10 ? "VIP" : "STANDARD",
        x: col * 25,
        y: row * 25,
        status: "AVAILABLE",
      });
    }
  }
  return seats;
}

export function generate1000VirtualUsers(
  jwtSecret: string,
): LoadTestUserEntry[] {
  const users: LoadTestUserEntry[] = [];
  for (let i = 1; i <= LOADTEST_USER_COUNT; i++) {
    const padded = String(i).padStart(12, "0");
    const userId = `a0000000-0000-4000-8000-${padded}`;
    const email = `loadtest.user.${i}@urticketbuddy.local`;
    const role = "CUSTOMER";
    const token = signLoadTestJwt({ sub: userId, email, role }, jwtSecret);
    users.push({ userId, email, role, token });
  }
  return users;
}

async function clearStaleRedisEventState(
  redis: Redis,
  eventId: string,
): Promise<void> {
  const patterns = [
    `seat_lock:{${eventId}}:*`,
    `user_holds:{${eventId}}:*`,
    `hold_extended:{${eventId}}:*`,
  ];

  for (const pattern of patterns) {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        500,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  }

  await redis.del(
    `seat_sold:{${eventId}}`,
    `hold_expiry:{${eventId}}`,
    `hold_owners:{${eventId}}`,
  );
}

export async function runLoadTestSeed(options?: {
  outputPath?: string;
  skipDb?: boolean;
}): Promise<LoadTestSeedManifest> {
  const env = loadEnv();
  const users = generate1000VirtualUsers(env.JWT_SECRET);
  const seats = generate5000SeatDefinitions(LOADTEST_EVENT_ID);

  if (!options?.skipDb) {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const venueRepo = AppDataSource.getRepository(Venue);
    const eventRepo = AppDataSource.getRepository(Event);
    const seatRepo = AppDataSource.getRepository(EventSeat);
    const userRepo = AppDataSource.getRepository(User);

    await venueRepo.upsert(
      {
        id: LOADTEST_VENUE_ID,
        name: "k6 Concurrency Arena (5,000 Seats)",
        location: "Karachi, PK",
      },
      ["id"],
    );

    await eventRepo.upsert(
      {
        id: LOADTEST_EVENT_ID,
        venueId: LOADTEST_VENUE_ID,
        name: "UTB-17 1,000-VU Flash Sale Benchmark",
        startTime: new Date(Date.now() + 7 * 86_400_000),
        status: "PUBLISHED",
      },
      ["id"],
    );

    // Reset existing seats for this benchmark event
    await seatRepo.delete({ eventId: LOADTEST_EVENT_ID });

    // Bulk insert 5,000 seats in chunks of 1,000
    const chunkSize = 1000;
    for (let i = 0; i < seats.length; i += chunkSize) {
      const chunk = seats.slice(i, i + chunkSize);
      await seatRepo
        .createQueryBuilder()
        .insert()
        .into(EventSeat)
        .values(chunk)
        .execute();
    }

    // Upsert the 1,000 virtual users
    for (let i = 0; i < users.length; i += 500) {
      const batch = users.slice(i, i + 500).map((u) => ({
        id: u.userId,
        email: u.email,
        passwordHash:
          "$2b$12$prehashedloadtestplaceholder000000000000000000000",
        role: u.role,
      }));
      await userRepo.upsert(batch, ["id"]);
    }

    const redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 2,
    });
    await clearStaleRedisEventState(redis, LOADTEST_EVENT_ID);
    await redis.quit();
    await AppDataSource.destroy();
  }

  const manifest: LoadTestSeedManifest = {
    venueId: LOADTEST_VENUE_ID,
    eventId: LOADTEST_EVENT_ID,
    seatCount: seats.length,
    targetSeatId: TARGET_CONTENTION_SEAT,
    generatedAt: new Date().toISOString(),
    users,
  };

  const outFile = options?.outputPath ?? path.resolve(__dirname, "users.json");
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

if (require.main === module) {
  const skipDb = process.argv.includes("--tokens-only");
  runLoadTestSeed({ skipDb })
    .then((manifest) => {
      process.stdout.write(
        `Seeded event ${manifest.eventId} (${manifest.seatCount} seats) and wrote ${manifest.users.length} JWTs to users.json\n`,
      );
    })
    .catch((err) => {
      process.stderr.write(
        `Load test seed failed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      process.exit(1);
    });
}
