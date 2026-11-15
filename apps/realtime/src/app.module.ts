import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { EventsGateway } from "./gateways/events.gateway";

@Module({
  imports: [HealthModule],
  providers: [EventsGateway],
})
export class AppModule {}
