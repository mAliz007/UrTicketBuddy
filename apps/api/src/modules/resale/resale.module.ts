import { Module } from "@nestjs/common";
import { PLATFORM_SETTINGS_PORT } from "../../common/ports";
import { DefaultPlatformSettingsProvider } from "../../common/ports/default-platform-settings.provider";
import { OrdersModule } from "../orders/orders.module";
import { ResaleController } from "./resale.controller";
import { ResaleService } from "./resale.service";

@Module({
  imports: [OrdersModule],
  controllers: [ResaleController],
  providers: [
    ResaleService,
    {
      provide: PLATFORM_SETTINGS_PORT,
      useClass: DefaultPlatformSettingsProvider,
    },
  ],
  exports: [ResaleService],
})
export class ResaleModule {}
