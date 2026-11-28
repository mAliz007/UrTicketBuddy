import { Injectable, Logger, Optional } from "@nestjs/common";
import { loadEnv } from "@urticketbuddy/config";
import Redis from "ioredis";
import * as net from "net";
import { SearchService } from "../search/search.service";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly env = loadEnv();

  constructor(
    @Optional()
    private readonly searchService?: SearchService,
  ) {}

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

    // 4. Check Elasticsearch (TCP probe + events alias existence)
    let esHost = "localhost";
    let esPort = 9200;
    try {
      const parsedEsUrl = new URL(this.env.ELASTICSEARCH_NODE);
      esHost = parsedEsUrl.hostname || esHost;
      esPort = parsedEsUrl.port
        ? Number(parsedEsUrl.port)
        : parsedEsUrl.protocol === "https:"
          ? 443
          : 9200;
    } catch {
      esHost = this.env.POSTGRES_HOST;
    }
    const esUp = await this.checkTcpPort(esHost, esPort);
    dependencies.elasticsearch = esUp ? "up" : "down";

    const eventsAliasExists =
      esUp && this.searchService
        ? await this.searchService.checkAliasExists()
        : false;

    return {
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
      dependencies,
      search: {
        alias: this.env.ELASTICSEARCH_INDEX_ALIAS,
        eventsAliasExists,
      },
    };
  }
}
