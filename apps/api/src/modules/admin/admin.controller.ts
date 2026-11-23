import {
  Controller,
  Get,
  Patch,
  Delete,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  ParseUUIDPipe,
} from "@nestjs/common";
import type { Request } from "express";
import {
  UserRole,
  AuditLogQuery,
  UpdateCommissionRateDto,
  UpdateCommissionRateSchema,
} from "@urticketbuddy/contracts";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AdminService, AdminActor } from "./admin.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * PATCH /api/v1/admin/orders/:orderId/flag
   * Flags order as fraudulent, increments ticket seedVersions, writes audit log.
   */
  @Patch("orders/:orderId/flag")
  @HttpCode(HttpStatus.OK)
  async flagOrder(
    @Param("orderId", new ParseUUIDPipe()) orderId: string,
    @CurrentUser() adminUser: AdminActor,
    @Body() body: { reason?: string },
    @Req() req: Request,
  ) {
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.ip;
    return this.adminService.flagOrder(
      orderId,
      adminUser,
      body?.reason,
      ipAddress,
    );
  }

  /**
   * DELETE /api/v1/admin/tickets/:ticketId
   * Revokes ticket, resets seat to AVAILABLE in Postgres and Redis, broadcasts update, writes audit log.
   */
  @Delete("tickets/:ticketId")
  @HttpCode(HttpStatus.OK)
  async revokeTicket(
    @Param("ticketId", new ParseUUIDPipe()) ticketId: string,
    @CurrentUser() adminUser: AdminActor,
    @Body() body: { reason?: string },
    @Req() req: Request,
  ) {
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.ip;
    return this.adminService.revokeTicket(
      ticketId,
      adminUser,
      body?.reason,
      ipAddress,
    );
  }

  /**
   * PATCH /api/v1/admin/organizers/:userId/approve
   * Approves organizer account and assigns organizerTenantId if missing.
   */
  @Patch("organizers/:userId/approve")
  @HttpCode(HttpStatus.OK)
  async approveOrganizer(
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @CurrentUser() adminUser: AdminActor,
    @Body() body: { reason?: string },
    @Req() req: Request,
  ) {
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.ip;
    return this.adminService.approveOrganizer(
      userId,
      adminUser,
      body?.reason,
      ipAddress,
    );
  }

  /**
   * PATCH /api/v1/admin/users/:userId/suspend
   * Suspends a user and invalidates all active sessions/refresh tokens.
   */
  @Patch("users/:userId/suspend")
  @HttpCode(HttpStatus.OK)
  async suspendUser(
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @CurrentUser() adminUser: AdminActor,
    @Body() body: { reason?: string },
    @Req() req: Request,
  ) {
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.ip;
    return this.adminService.suspendUser(
      userId,
      adminUser,
      body?.reason,
      ipAddress,
    );
  }

  /**
   * GET /api/v1/admin/settings/commission
   * Reads current global commission rate percent.
   */
  @Get("settings/commission")
  @HttpCode(HttpStatus.OK)
  async getCommission() {
    return this.adminService.getCommissionSettings();
  }

  /**
   * PUT /api/v1/admin/settings/commission
   * Updates global commission rate percent (0 to 50 percent).
   */
  @Put("settings/commission")
  @HttpCode(HttpStatus.OK)
  async updateCommission(
    @Body() body: UpdateCommissionRateDto,
    @CurrentUser() adminUser: AdminActor,
    @Req() req: Request,
  ) {
    const parsed = UpdateCommissionRateSchema.parse(body);
    const rate =
      parsed.commissionRatePercent ?? parsed.commissionRate ?? parsed.value;
    const ipAddress = (req.headers["x-forwarded-for"] as string) || req.ip;
    return this.adminService.updateCommissionRate(
      rate as number,
      adminUser,
      ipAddress,
    );
  }

  /**
   * GET /api/v1/admin/audit-logs
   * Filterable (?actorId=&action=&entityType=&page=&pageSize=) and paginated audit log trail.
   */
  @Get("audit-logs")
  @HttpCode(HttpStatus.OK)
  async getAuditLogs(@Query() query: AuditLogQuery) {
    return this.adminService.getAuditLogs(query);
  }
}
