import { Controller, Get, Put, Body, UseGuards } from "@nestjs/common";
import {
  AuthUser,
  UpdateProfileRequest,
  UserRole,
} from "@urticketbuddy/contracts";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.CUSTOMER,
  UserRole.ORGANIZER,
  UserRole.GATE_STAFF,
  UserRole.ADMIN,
)
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get("me/profile")
  async getProfile(@CurrentUser() user: AuthUser) {
    return this.authService.getProfile(user.id);
  }

  @Put("me/profile")
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateProfileRequest,
  ) {
    return this.authService.updateProfile(user.id, body);
  }
}
