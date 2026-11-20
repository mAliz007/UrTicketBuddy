import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { TicketsService } from "./tickets.service";

@Controller("users/me/tickets")
@UseGuards(JwtAuthGuard)
export class UserTicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  /**
   * GET /api/v1/users/me/tickets
   * Returns all tickets owned by the authenticated caller.
   */
  @Get()
  async getUserTickets(@CurrentUser() user: { id?: string; userId?: string }) {
    const userId = user.id || user.userId;
    return this.ticketsService.getUserTickets(userId!);
  }
}
