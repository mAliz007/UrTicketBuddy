import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  UserRole,
  AuthUser,
  CreateGateStaffRequest,
} from "@urticketbuddy/contracts";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./decorators/roles.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";

@Controller("organizer")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizerController {
  constructor(private readonly authService: AuthService) {}

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post("gate-staff")
  @HttpCode(HttpStatus.CREATED)
  async createGateStaff(
    @CurrentUser() user: AuthUser,
    @Body() body: CreateGateStaffRequest,
  ) {
    return this.authService.createGateStaff(user, body);
  }
}
