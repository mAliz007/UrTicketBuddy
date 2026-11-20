import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { EventsGateway } from "./gateways/events.gateway";
import { GatewayModule } from "./gateway/gateway.module";

@Module({
  imports: [HealthModule, GatewayModule],
  providers: [EventsGateway],
})
export class AppModule {}
