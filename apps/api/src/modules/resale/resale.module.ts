import { Module } from "@nestjs/common";
import { PLATFORM_SETTINGS_PORT } from "../../common/ports";
import { AdminModule } from "../admin/admin.module";
import { PlatformSettingsService } from "../admin/platform-settings.service";
import { OrdersModule } from "../orders/orders.module";
import { ResaleController } from "./resale.controller";
import { ResaleService } from "./resale.service";

@Module({
  imports: [OrdersModule, AdminModule],
  controllers: [ResaleController],
  providers: [
    ResaleService,
    {
      provide: PLATFORM_SETTINGS_PORT,
      useExisting: PlatformSettingsService,
    },
  ],
  exports: [ResaleService],
})
export class ResaleModule {}
