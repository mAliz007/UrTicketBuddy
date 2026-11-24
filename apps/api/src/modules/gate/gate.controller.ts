import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ParseUUIDPipe,
} from "@nestjs/common";
import { UserRole, ErrorCode } from "@urticketbuddy/contracts";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuditLogInterceptor } from "../admin/audit-log.interceptor";
import { GateService } from "./gate.service";
import { ScanTicketDto } from "./dto/scan-ticket.dto";

@Controller("gate")
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AuditLogInterceptor)
export class GateController {
  constructor(private readonly gateService: GateService) {}

  /**
   * POST /api/v1/gate/scan
   * Validates dynamic QR token at gate.
   * Protected for GATE_STAFF, ORGANIZER, and ADMIN roles.
   */
  @Post("scan")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.GATE_STAFF, UserRole.ORGANIZER, UserRole.ADMIN)
  async scanTicket(
    @Body() dto: ScanTicketDto,
    @CurrentUser()
    user: {
      id?: string;
      userId?: string;
      email?: string;
      role?: string;
      organizerTenantId?: string;
    },
  ) {
    const scannedBy = user?.id || user?.userId || user?.email || "gate-staff";
    return this.gateService.scanTicket(dto, scannedBy, user);
  }

  /**
   * GET /api/v1/gate/metrics
   * Provides real-time scan and entry velocity metrics.
   * Protected for GATE_STAFF, ORGANIZER, and ADMIN roles.
   */
  @Get("metrics")
  @Roles(UserRole.GATE_STAFF, UserRole.ORGANIZER, UserRole.ADMIN)
  async getMetrics(
    @Query("eventId", new ParseUUIDPipe()) eventId: string,
    @CurrentUser()
    user: {
      id?: string;
      userId?: string;
      email?: string;
      role?: string;
      organizerTenantId?: string;
    },
  ) {
    if (!eventId) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Query parameter 'eventId' is required",
      });
    }
    return this.gateService.getMetrics(eventId, user);
  }
}
