import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { HealthModule } from "./health/health.module";
import { WorkerInfraModule } from "./infrastructure/worker-infra.module";
import { HoldExpiryProcessor } from "./processors/hold-expiry.processor";

@Module({
  imports: [ScheduleModule.forRoot(), WorkerInfraModule, HealthModule],
  providers: [HoldExpiryProcessor],
})
export class AppModule {}
