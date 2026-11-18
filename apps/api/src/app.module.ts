import { Module } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module";
import { DatabaseModule } from "./database/database.module";
import { VenuesModule } from "./modules/venues/venues.module";
import { EventsModule } from "./modules/events/events.module";
import { AuthModule } from "./modules/auth/auth.module";

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    VenuesModule,
    EventsModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
