import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { Worker, Job } from "bullmq";
import { loadEnv } from "@urticketbuddy/config";
import { HoldExpiryJob } from "@urticketbuddy/contracts";

@Injectable()
export class HoldExpiryProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoldExpiryProcessor.name);
  private worker?: Worker;

  onModuleInit() {
    const env = loadEnv();
    try {
      this.worker = new Worker<HoldExpiryJob>(
        "hold-expiry",
        async (job: Job<HoldExpiryJob>) => {
          this.logger.log(
            `Processing hold expiry for seat: ${job.data.seatId}`,
          );
        },
        {
          connection: {
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            password: env.REDIS_PASSWORD,
          },
          autorun: false, // will run when Redis is connected
        },
      );
    } catch (err) {
      this.logger.warn(
        "Redis worker initialization deferred (Redis not available)",
        err,
      );
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}
