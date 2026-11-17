import { Module } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module";
import { DatabaseModule } from "./database/database.module";
import { VenuesModule } from "./modules/venues/venues.module";

@Module({
  imports: [DatabaseModule, HealthModule, VenuesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
