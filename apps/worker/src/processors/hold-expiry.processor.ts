import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
  Logger,
} from "@nestjs/common";
import { Queue, Worker, Job } from "bullmq";
import { loadEnv } from "@urticketbuddy/config";
import { HoldExpiryJob } from "@urticketbuddy/contracts";
import { ExpiryService } from "../modules/expiry/expiry.service";

export const HOLD_EXPIRY_QUEUE_NAME = "hold-expiry";
export const HOLD_EXPIRY_REPEATABLE_JOB_NAME = "expire-due-holds";
export const HOLD_EXPIRY_REPEAT_EVERY_MS = 1000;

@Injectable()
export class HoldExpiryProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoldExpiryProcessor.name);
  private queue?: Queue;
  private worker?: Worker;

  constructor(@Optional() private readonly expiryService?: ExpiryService) {}

  async onModuleInit(): Promise<void> {
    const env = loadEnv();
    const connection = {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    };

    try {
      this.queue = new Queue(HOLD_EXPIRY_QUEUE_NAME, {
        connection,
      });

      this.worker = new Worker<HoldExpiryJob | { intervalMs?: number }>(
        HOLD_EXPIRY_QUEUE_NAME,
        async (job: Job<HoldExpiryJob | { intervalMs?: number }>) => {
          if (this.expiryService) {
            await this.expiryService.handleCron();
          } else if ("seatId" in job.data) {
            this.logger.log(
              `Processing hold expiry for seat: ${job.data.seatId}`,
            );
          }
        },
        {
          connection,
          autorun: false,
        },
      );

      // Schedule real 1-second repeatable BullMQ hold-expiry job
      if (process.env.NODE_ENV !== "test") {
        await this.scheduleRepeatableJob();
      }
    } catch (err) {
      this.logger.warn(
        "Redis BullMQ hold-expiry initialization deferred (Redis not available)",
        err,
      );
    }
  }

  async scheduleRepeatableJob(): Promise<void> {
    if (!this.queue) return;
    await this.queue.add(
      HOLD_EXPIRY_REPEATABLE_JOB_NAME,
      { intervalMs: HOLD_EXPIRY_REPEAT_EVERY_MS },
      {
        repeat: { every: HOLD_EXPIRY_REPEAT_EVERY_MS },
        jobId: "repeatable-hold-expiry-1s",
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
    this.logger.log(
      `Registered repeatable BullMQ job '${HOLD_EXPIRY_REPEATABLE_JOB_NAME}' on queue '${HOLD_EXPIRY_QUEUE_NAME}' (every ${HOLD_EXPIRY_REPEAT_EVERY_MS}ms)`,
    );
  }

  getRepeatConfig(): {
    queueName: string;
    jobName: string;
    everyMs: number;
  } {
    return {
      queueName: HOLD_EXPIRY_QUEUE_NAME,
      jobName: HOLD_EXPIRY_REPEATABLE_JOB_NAME,
      everyMs: HOLD_EXPIRY_REPEAT_EVERY_MS,
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }
}
