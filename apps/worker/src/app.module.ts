import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { HoldExpiryProcessor } from "./processors/hold-expiry.processor";

@Module({
  imports: [HealthModule],
  providers: [HoldExpiryProcessor],
})
export class AppModule {}
