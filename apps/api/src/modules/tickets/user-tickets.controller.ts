import { Controller, Get, UseGuards } from "@nestjs/common";
import { UserRole } from "@urticketbuddy/contracts";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { TicketsService } from "./tickets.service";

@Controller("users/me/tickets")
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserTicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * GET /api/v1/users/me/tickets
   * Returns all tickets owned by the authenticated caller.
   */
  @Get()
  @Roles(
    UserRole.CUSTOMER,
    UserRole.ORGANIZER,
    UserRole.GATE_STAFF,
    UserRole.ADMIN,
  )
  async getUserTickets(@CurrentUser() user: { id?: string; userId?: string }) {
    const userId = user.id || user.userId;
    return this.ticketsService.getUserTickets(userId!);
  }
}
