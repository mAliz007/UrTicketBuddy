import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import { UserRole } from "@urticketbuddy/contracts";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { TicketsService } from "./tickets.service";

@Controller("tickets")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * GET /api/v1/tickets/:ticketId/dynamic-qr
   * Generates a 30-second time-decaying dynamic QR token.
   * Enforces caller ownership (or ADMIN) and ISSUED status.
   */
  @Get(":ticketId/dynamic-qr")
  async getDynamicQr(
    @Param("ticketId", new ParseUUIDPipe()) ticketId: string,
    @CurrentUser()
    user: { id?: string; userId?: string; email?: string; role: UserRole },
  ) {
    return this.ticketsService.getDynamicQr(ticketId, user);
  }

  /**
   * PATCH /api/v1/tickets/:ticketId/rotate-key
   * Protected by @Roles(UserRole.ADMIN).
   * Increments seedVersion by 1, immediately invalidating previously issued tokens.
   */
  @Patch(":ticketId/rotate-key")
  @Roles(UserRole.ADMIN)
  async rotateKey(@Param("ticketId", new ParseUUIDPipe()) ticketId: string) {
    const updated = await this.ticketsService.rotateKey(ticketId);
    return {
      message: "Ticket key rotated successfully",
      ticketId: updated.id,
      seedVersion: updated.seedVersion,
    };
  }

  /**
   * GET /api/v1/tickets/me
   * Convenience route returning all tickets owned by authenticated user.
   */
  @Get("me")
  async getMyTickets(
    @CurrentUser()
    user: {
      id?: string;
      userId?: string;
      email?: string;
      role: UserRole;
    },
  ) {
    const userId = user.id || user.userId;
    return this.ticketsService.getUserTickets(userId!);
  }
}
