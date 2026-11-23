import { Module } from "@nestjs/common";
import { HealthModule } from "./modules/health/health.module";
import { DatabaseModule } from "./database/database.module";
import { BloomModule } from "./common/bloom/bloom.module";
import { VenuesModule } from "./modules/venues/venues.module";
import { EventsModule } from "./modules/events/events.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CheckoutModule } from "./modules/checkout/checkout.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { TicketsModule } from "./modules/tickets/tickets.module";
import { GateModule } from "./modules/gate/gate.module";
import { MediaModule } from "./modules/media/media.module";

@Module({
  imports: [
    DatabaseModule,
    BloomModule,
    HealthModule,
    VenuesModule,
    EventsModule,
    AuthModule,
    CheckoutModule,
    OrdersModule,
    TicketsModule,
    GateModule,
    MediaModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
