import { Injectable, Logger } from "@nestjs/common";
import { loadEnv } from "@urticketbuddy/config";
import Redis from "ioredis";
import * as net from "net";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly env = loadEnv();

  private checkTcpPort(
    host: string,
    port: number,
    timeoutMs = 1000,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, host);
    });
  }

  async checkHealth() {
    const dependencies: Record<string, "up" | "down"> = {
      postgres: "down",
      mongo: "down",
      redis: "down",
      elasticsearch: "down",
    };

    // 1. Check Postgres (PgBouncer on port 6432)
    const pgUp = await this.checkTcpPort(
      this.env.POSTGRES_HOST,
      this.env.POSTGRES_PORT,
    );
    dependencies.postgres = pgUp ? "up" : "down";

    // 2. Check Redis (port 6379 or ping)
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
      dependencies.redis = pong === "PONG" ? "up" : "down";
    } catch {
      dependencies.redis = "down";
    }

    // 3. Check MongoDB (port 27017)
    const mongoUp = await this.checkTcpPort(this.env.POSTGRES_HOST, 27017);
    dependencies.mongo = mongoUp ? "up" : "down";

    // 4. Check Elasticsearch (port 9200)
    const esUp = await this.checkTcpPort(this.env.POSTGRES_HOST, 9200);
    dependencies.elasticsearch = esUp ? "up" : "down";

    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }
}
