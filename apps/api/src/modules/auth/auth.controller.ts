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
  UseInterceptors,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { loadEnv } from "@urticketbuddy/config";
import { UserRole, AuthUser, ErrorCode } from "@urticketbuddy/contracts";
import type { User } from "@urticketbuddy/db";
import { AuditLogInterceptor } from "../admin/audit-log.interceptor";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { Public } from "./decorators/public.decorator";
import { Roles } from "./decorators/roles.decorator";
import { CurrentUser } from "./decorators/current-user.decorator";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";

@Controller("auth")
@UseInterceptors(AuditLogInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private stripRefreshToken<T extends { refreshToken?: string }>(
    result: T,
  ): Omit<T, "refreshToken"> {
    if (!result || typeof result !== "object") {
      return result;
    }
    const clone = { ...result };
    delete clone.refreshToken;
    return clone;
  }

  private assertRefreshCsrf(req: Request): void {
    const env = loadEnv();
    const allowedOrigins = (env.CORS_ORIGINS || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    const originHeader = req.headers?.origin;
    const refererHeader = req.headers?.referer;

    if (originHeader && allowedOrigins.length > 0) {
      if (!allowedOrigins.includes(originHeader)) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: "CSRF check failed: untrusted Origin header",
        });
      }
    } else if (refererHeader && allowedOrigins.length > 0) {
      const matchesAllowed = allowedOrigins.some((allowed) =>
        refererHeader.startsWith(allowed),
      );
      if (!matchesAllowed) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: "CSRF check failed: untrusted Referer header",
        });
      }
    }

    const xsrfCookie = req.cookies?.["XSRF-TOKEN"];
    const csrfHeader =
      (req.headers?.["x-csrf-token"] as string | undefined) ||
      (req.headers?.["x-xsrf-token"] as string | undefined);

    if (xsrfCookie || csrfHeader) {
      if (!xsrfCookie || !csrfHeader || xsrfCookie !== csrfHeader) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message: "CSRF check failed: invalid or missing CSRF token",
        });
      }
    }
  }

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(registerDto, res);
    return this.stripRefreshToken(result);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto, res);
    return this.stripRefreshToken(result);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Body("refreshToken") bodyToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertRefreshCsrf(req);

    // Do NOT accept refresh token in JSON request body (F-7)
    if (bodyToken !== undefined) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_REFRESH_TOKEN,
        message:
          "Refresh token must be supplied via HttpOnly cookie, not request body",
      });
    }

    const rawToken = req.cookies?.refreshToken;
    if (!rawToken) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_REFRESH_TOKEN,
        message: "No refresh token cookie provided",
      });
    }
    const result = await this.authService.refresh(rawToken, res);
    return this.stripRefreshToken(result);
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Body("refreshToken") _bodyToken: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawToken = req.cookies?.refreshToken;
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

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.CUSTOMER,
    UserRole.ORGANIZER,
    UserRole.GATE_STAFF,
    UserRole.ADMIN,
  )
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
