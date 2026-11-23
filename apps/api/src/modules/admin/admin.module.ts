import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { AuditService } from "./audit.service";
import { PlatformSettingsService } from "./platform-settings.service";
import { AuditLogInterceptor } from "./audit-log.interceptor";

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    AuditService,
    PlatformSettingsService,
    AuditLogInterceptor,
  ],
  exports: [
    AdminService,
    AuditService,
    PlatformSettingsService,
    AuditLogInterceptor,
  ],
})
export class AdminModule {}
