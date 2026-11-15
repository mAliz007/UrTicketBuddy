import { Injectable } from "@nestjs/common";
import { loadEnv } from "@urticketbuddy/config";
import Redis from "ioredis";

@Injectable()
export class HealthService {
  private readonly env = loadEnv();

  async checkHealth() {
    let redisStatus: "up" | "down" = "down";

    try {
      const redis = new Redis({
        host: this.env.REDIS_HOST,
        port: this.env.REDIS_PORT,
        password: this.env.REDIS_PASSWORD,
        connectTimeout: 1000,
        maxRetriesPerRequest: 1,
      });
      const pong = await redis.ping();
      await redis.quit();
      if (pong === "PONG") {
        redisStatus = "up";
      }
    } catch {
      redisStatus = "down";
    }

    return {
      status: "ok",
      service: "worker",
      timestamp: new Date().toISOString(),
      dependencies: {
        redis: redisStatus,
      },
    };
  }
}
