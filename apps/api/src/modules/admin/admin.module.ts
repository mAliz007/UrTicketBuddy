import { Global, Module } from "@nestjs/common";
import { PLATFORM_SETTINGS_PORT } from "../../common/ports";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AuditService } from "./audit.service";
import { PlatformSettingsService } from "./platform-settings.service";
import { AuditLogInterceptor } from "./audit-log.interceptor";

@Global()
@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    AuditService,
    PlatformSettingsService,
    {
      provide: PLATFORM_SETTINGS_PORT,
      useExisting: PlatformSettingsService,
    },
    AuditLogInterceptor,
  ],
  exports: [
    AdminService,
    AuditService,
    PlatformSettingsService,
    PLATFORM_SETTINGS_PORT,
    AuditLogInterceptor,
  ],
})
export class AdminModule {}
