import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { Client, errors as esErrors } from "@elastic/elasticsearch";
import { Job, UnrecoverableError, Worker } from "bullmq";
import { DataSource } from "typeorm";
import { loadEnv } from "@urticketbuddy/config";
import {
  SEARCH_INDEX_QUEUE,
  SearchIndexJob,
  SearchIndexJobSchema,
} from "@urticketbuddy/contracts";
import { Event } from "@urticketbuddy/db";
import {
  WORKER_DATA_SOURCE,
  WORKER_ELASTICSEARCH_CLIENT,
} from "../infrastructure/worker-infra.tokens";
import { ensureEventsIndexAndAlias } from "./search-index.schema";

export const SEARCH_INDEX_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: "exponential" as const,
    delay: 1000,
  },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

@Injectable()
export class SearchIndexProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchIndexProcessor.name);
  private worker?: Worker<SearchIndexJob>;
  private readonly aliasName: string;
  private indexEnsured = false;

  constructor(
    @Inject(WORKER_ELASTICSEARCH_CLIENT)
    private readonly esClient: Client,
    @Optional()
    @Inject(WORKER_DATA_SOURCE)
    private readonly dataSource: DataSource | null = null,
  ) {
    const env = loadEnv();
    this.aliasName = env.ELASTICSEARCH_INDEX_ALIAS;
  }

  async onModuleInit(): Promise<void> {
    const env = loadEnv();
    if (
      env.NODE_ENV === "test" &&
      process.env.START_SEARCH_WORKER_IN_TEST !== "true"
    ) {
      return;
    }

    try {
      await this.ensureReady();
    } catch (err) {
      this.logger.warn(
        `Elasticsearch index initialization deferred (ES unreachable at boot): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    try {
      this.worker = new Worker<SearchIndexJob>(
        SEARCH_INDEX_QUEUE,
        async (job: Job<SearchIndexJob>) => {
          return this.processSearchIndexJob(job.data);
        },
        {
          connection: {
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            password: env.REDIS_PASSWORD || undefined,
          },
          concurrency: 5,
        },
      );

      this.worker.on("failed", (job, err) => {
        this.logger.warn(
          `Search-index job ${job?.id ?? "unknown"} failed (attempt ${job?.attemptsMade ?? 0}): ${err.message}`,
        );
      });
    } catch (err) {
      this.logger.warn(
        `SearchIndexProcessor BullMQ worker initialization deferred: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close().catch(() => undefined);
    }
  }

  async ensureReady(): Promise<void> {
    if (this.indexEnsured) return;
    await ensureEventsIndexAndAlias(this.esClient, this.aliasName);
    this.indexEnsured = true;
  }

  async processSearchIndexJob(rawData: unknown): Promise<{
    action: "indexed" | "updated" | "deleted";
    id: string;
  }> {
    const parsed = SearchIndexJobSchema.safeParse(rawData);
    if (!parsed.success) {
      throw new UnrecoverableError(
        `Invalid search-index job payload: ${parsed.error.message}`,
      );
    }

    const data = parsed.data;
    const eventId = data.eventId ?? data.id!;

    try {
      await this.ensureReady();
    } catch (err) {
      this.indexEnsured = false;
      throw err;
    }

    if (data.action === "delete") {
      await this.deleteFromIndex(eventId);
      return { action: "deleted", id: eventId };
    }

    // Load from Postgres when connected so published/cancelled status stays authoritative
    let dbEvent: Event | null = null;
    if (this.dataSource?.isInitialized) {
      dbEvent = await this.dataSource.getRepository(Event).findOne({
        where: { id: eventId },
        relations: ["venue"],
      });
    }

    const effectiveStatus = dbEvent?.status ?? data.status ?? "PUBLISHED";
    if (effectiveStatus !== "PUBLISHED" || (!dbEvent && !data.title)) {
      await this.deleteFromIndex(eventId);
      return { action: "deleted", id: eventId };
    }

    const startsAtRaw = data.startsAt ?? dbEvent?.startTime ?? new Date();
    const startsAt =
      startsAtRaw instanceof Date
        ? startsAtRaw.toISOString()
        : new Date(startsAtRaw).toISOString();

    const document = {
      id: eventId,
      title: data.title ?? dbEvent!.name,
      description: data.description ?? "",
      city: data.city ?? dbEvent?.venue?.location ?? "",
      category: data.category ?? "general",
      startsAt,
      status: effectiveStatus,
      venueId: data.venueId ?? dbEvent?.venueId ?? "",
      venueName: data.venueName ?? dbEvent?.venue?.name ?? "",
      location: data.location ?? null,
      minPrice: data.minPrice ?? 0,
      maxPrice: data.maxPrice ?? 0,
    };

    try {
      await this.esClient.index({
        index: this.aliasName,
        id: eventId,
        document,
      });
    } catch (err) {
      this.indexEnsured = false;
      throw err;
    }

    this.logger.log(
      `Idempotently ${data.action === "update" ? "updated" : "indexed"} event ${eventId} into alias ${this.aliasName}`,
    );

    return {
      action: data.action === "update" ? "updated" : "indexed",
      id: eventId,
    };
  }

  private async deleteFromIndex(eventId: string): Promise<void> {
    try {
      await this.esClient.delete({
        index: this.aliasName,
        id: eventId,
      });
      this.logger.log(`Deleted event ${eventId} from alias ${this.aliasName}`);
    } catch (err) {
      if (this.isNotFoundError(err)) {
        return;
      }
      this.indexEnsured = false;
      throw err;
    }
  }

  private isNotFoundError(err: unknown): boolean {
    if (err instanceof esErrors.ResponseError && err.statusCode === 404) {
      return true;
    }
    const statusCode =
      (err as { statusCode?: number; meta?: { statusCode?: number } })
        ?.statusCode ??
      (err as { meta?: { statusCode?: number } })?.meta?.statusCode;
    return statusCode === 404;
  }
}
