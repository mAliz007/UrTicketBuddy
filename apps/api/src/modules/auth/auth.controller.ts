import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { UserRole, AuthUser, ErrorCode } from "@urticketbuddy/contracts";
import type { User } from "@urticketbuddy/db";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { Public } from "./decorators/public.decorator";
import { Roles } from "./decorators/roles.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.register(registerDto, res);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(loginDto, res);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Body("refreshToken") bodyToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.refreshToken || bodyToken;
    if (!rawToken) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_REFRESH_TOKEN,
        message: "No refresh token provided",
      });
    }
    return this.authService.refresh(rawToken, res);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Body("refreshToken") bodyToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.refreshToken || bodyToken;
    await this.authService.logout(rawToken, res);
    return { success: true };
  }

  @Public()
  @Get("google")
  @UseGuards(AuthGuard("google"))
  async googleAuth() {
    // Initiates Google OAuth redirect
  }

  @Public()
  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleAuthCallback(
    @Req() req: Request & { user: User },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.handleOAuthLogin(req.user, res);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getProfile(@CurrentUser() user: AuthUser) {
    return { user };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get("admin-only")
  async adminOnly(@CurrentUser() user: AuthUser) {
    return { message: "Admin access granted", user };
  }
}
