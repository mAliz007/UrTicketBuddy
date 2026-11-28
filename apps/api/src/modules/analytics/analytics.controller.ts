import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { UserRole } from "@urticketbuddy/contracts";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { OwnershipGuard } from "../auth/guards/ownership.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AnalyticsService, AnalyticsRequester } from "./analytics.service";

@Controller("organizer/analytics")
@UseGuards(JwtAuthGuard, RolesGuard, OwnershipGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /api/v1/organizer/analytics/:eventId
   * Protected for ORGANIZER and ADMIN roles with tenant ownership isolation.
   */
  @Get(":eventId")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  async getEventAnalytics(
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AnalyticsRequester,
  ) {
    return this.analyticsService.getEventAnalytics(eventId, user);
  }
}
