import {
  Injectable,
  Inject,
  Optional,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import type { Response } from "express";
import { User, RefreshToken, AuditLog } from "@urticketbuddy/db";
import { loadEnv } from "@urticketbuddy/config";
import { hashPasswordArgon2id, verifyPasswordArgon2id } from "./password.util";
import {
  ErrorCode,
  UserRole,
  RegisterRequestSchema,
  RegisterRequestInput,
  LoginRequestSchema,
  LoginRequest,
  AuthResponse,
  AuthUser,
  CreateGateStaffRequest,
  CreateGateStaffRequestSchema,
  UpdateProfileRequest,
  UpdateProfileRequestSchema,
} from "@urticketbuddy/contracts";
import {
  USER_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  AUDIT_LOG_REPOSITORY,
} from "../../database/database.tokens";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: Repository<User>,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    @Optional()
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository?: Repository<AuditLog>,
  ) {}

  async register(
    data: RegisterRequestInput,
    res?: Response,
  ): Promise<AuthResponse> {
    if (
      data &&
      typeof data === "object" &&
      "role" in data &&
      (data as Record<string, unknown>).role !== undefined
    ) {
      throw new UnprocessableEntityException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Role cannot be specified during registration",
      });
    }

    const parsed = RegisterRequestSchema.safeParse(data);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid registration payload",
        details: parsed.error.issues,
      });
    }

    const { email, password, firstName, lastName } = parsed.data;

    const existing = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException({
        code: ErrorCode.EMAIL_ALREADY_EXISTS,
        message: `User with email ${email} already exists`,
      });
    }

    const passwordHash = await hashPasswordArgon2id(password);

    const user = this.userRepository.create({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: UserRole.CUSTOMER,
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.log(`User registered: ${savedUser.id} (${savedUser.email})`);

    const familyId = crypto.randomUUID();
    const tokens = await this.generateTokens(savedUser);
    await this.persistRefreshToken(savedUser.id, tokens.refreshToken, familyId);

    if (res) {
      this.setRefreshTokenCookie(res, tokens.refreshToken);
    }

    return {
      user: this.sanitizeUser(savedUser),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(data: LoginRequest, res?: Response): Promise<AuthResponse> {
    const parsed = LoginRequestSchema.safeParse(data);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid login payload",
        details: parsed.error.issues,
      });
    }

    const { email, password } = parsed.data;

    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: "Invalid email or password",
      });
    }

    if (user.isSuspended) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: "User account is suspended",
      });
    }

    const isPasswordValid = await verifyPasswordArgon2id(
      password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: "Invalid email or password",
      });
    }

    this.logger.log(`User logged in: ${user.id} (${user.email})`);

    const familyId = crypto.randomUUID();
    const tokens = await this.generateTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken, familyId);

    if (res) {
      this.setRefreshTokenCookie(res, tokens.refreshToken);
    }

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(
    rawRefreshToken: string,
    res?: Response,
  ): Promise<AuthResponse> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_REFRESH_TOKEN,
        message: "Missing refresh token",
      });
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!storedToken) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_REFRESH_TOKEN,
        message: "Invalid refresh token",
      });
    }

    // Reuse detection: if token is already revoked, revoke whole token family
    if (storedToken.isRevoked) {
      this.logger.warn(
        `Token reuse detected for family ${storedToken.familyId} user ${storedToken.userId}. Revoking family.`,
      );
      await this.refreshTokenRepository.update(
        { familyId: storedToken.familyId },
        { isRevoked: true },
      );
      if (this.auditLogRepository) {
        try {
          const entry = this.auditLogRepository.create({
            actorId: storedToken.userId,
            actorRole: "CUSTOMER",
            action: "TOKEN_REUSE_DETECTED",
            entityType: "RefreshToken",
            entityId: storedToken.familyId,
            summary: `Token reuse detected for family ${storedToken.familyId}. All active sessions revoked.`,
            beforeState: { familyId: storedToken.familyId, isRevoked: false },
            afterState: { familyId: storedToken.familyId, isRevoked: true },
          });
          await this.auditLogRepository.save(entry);
        } catch (auditErr) {
          this.logger.warn(`Failed to audit token reuse: ${auditErr}`);
        }
      }
      if (res) {
        this.clearRefreshTokenCookie(res);
      }
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_REFRESH_TOKEN,
        message: "Token reuse detected; all sessions revoked",
      });
    }

    if (new Date() > new Date(storedToken.expiresAt)) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_REFRESH_TOKEN,
        message: "Refresh token has expired",
      });
    }

    const user = await this.userRepository.findOne({
      where: { id: storedToken.userId },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: "User not found",
      });
    }

    if (user.isSuspended) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: "User account is suspended",
      });
    }

    // Mark current token as used/revoked (rotation)
    storedToken.isRevoked = true;
    await this.refreshTokenRepository.save(storedToken);

    // Issue new token pair preserving the same familyId
    const tokens = await this.generateTokens(user);
    await this.persistRefreshToken(
      user.id,
      tokens.refreshToken,
      storedToken.familyId,
    );

    if (res) {
      this.setRefreshTokenCookie(res, tokens.refreshToken);
    }

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(rawRefreshToken?: string, res?: Response): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      await this.refreshTokenRepository.update(
        { tokenHash },
        { isRevoked: true },
      );
    }
    if (res) {
      this.clearRefreshTokenCookie(res);
    }
  }

  async handleOAuthLogin(
    user: User,
    res: Response,
  ): Promise<{ user: AuthUser; accessToken: string }> {
    const familyId = crypto.randomUUID();
    const tokens = await this.generateTokens(user);
    await this.persistRefreshToken(user.id, tokens.refreshToken, familyId);
    if (res) {
      this.setRefreshTokenCookie(res, tokens.refreshToken);
    }
    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
    };
  }

  async findOrCreateGoogleUser(profile: {
    email?: string;
    firstName: string;
    lastName: string;
    emailVerified?: boolean;
  }): Promise<User> {
    if (!profile.email) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Google profile has no email",
      });
    }

    if (profile.emailVerified === false) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: "Google email is not verified",
      });
    }

    let user = await this.userRepository.findOne({
      where: { email: profile.email.toLowerCase() },
    });

    if (!user) {
      const dummyPasswordHash = await hashPasswordArgon2id(crypto.randomUUID());
      user = this.userRepository.create({
        email: profile.email.toLowerCase(),
        passwordHash: dummyPasswordHash,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: UserRole.CUSTOMER,
      });
      user = await this.userRepository.save(user);
    }

    return user;
  }

  async createGateStaff(
    creator: AuthUser,
    data: CreateGateStaffRequest,
  ): Promise<AuthUser> {
    const parsed = CreateGateStaffRequestSchema.safeParse(data);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid gate staff payload",
        details: parsed.error.issues,
      });
    }

    const { email, password, firstName, lastName, organizerTenantId } =
      parsed.data;

    const existing = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException({
        code: ErrorCode.EMAIL_ALREADY_EXISTS,
        message: `User with email ${email} already exists`,
      });
    }

    let tenantId: string | null = null;
    if (creator.role === UserRole.ORGANIZER) {
      const creatorTenantId = creator.organizerTenantId || creator.id;
      if (organizerTenantId && organizerTenantId !== creatorTenantId) {
        throw new ForbiddenException({
          code: ErrorCode.FORBIDDEN,
          message:
            "Cross-tenant access forbidden: cannot provision gate staff for another organizer",
        });
      }
      tenantId = creatorTenantId;
    } else if (creator.role === UserRole.ADMIN) {
      tenantId = organizerTenantId || creator.organizerTenantId || null;
    } else {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: "Only ORGANIZER or ADMIN can provision gate staff",
      });
    }

    const passwordHash = await hashPasswordArgon2id(password);
    const staff = this.userRepository.create({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: UserRole.GATE_STAFF,
      organizerTenantId: tenantId,
    });

    const saved = await this.userRepository.save(staff);
    this.logger.log(
      `Gate staff created: ${saved.id} for organizer tenant ${tenantId}`,
    );

    return this.sanitizeUser(saved);
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileRequest,
  ): Promise<AuthUser> {
    const parsed = UpdateProfileRequestSchema.safeParse(data);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid profile update payload",
        details: parsed.error.issues,
      });
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: "User not found",
      });
    }

    if (parsed.data.firstName) user.firstName = parsed.data.firstName;
    if (parsed.data.lastName) user.lastName = parsed.data.lastName;

    const saved = await this.userRepository.save(user);
    return this.sanitizeUser(saved);
  }

  async getProfile(userId: string): Promise<AuthUser> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: "User not found",
      });
    }
    return this.sanitizeUser(user);
  }

  setRefreshTokenCookie(res: Response, token: string): void {
    const env = loadEnv();
    const isProd = env.NODE_ENV === "production";
    res.cookie("refreshToken", token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/v1/auth",
    });
    const csrfToken = crypto
      .createHmac("sha256", env.JWT_REFRESH_SECRET)
      .update(token)
      .digest("hex");
    res.cookie("XSRF-TOKEN", csrfToken, {
      httpOnly: false,
      secure: isProd,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/api/v1/auth",
    });
  }

  clearRefreshTokenCookie(res: Response): void {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      sameSite: "strict",
      path: "/api/v1/auth",
    });
    res.clearCookie("XSRF-TOKEN", {
      httpOnly: false,
      sameSite: "strict",
      path: "/api/v1/auth",
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private async persistRefreshToken(
    userId: string,
    token: string,
    familyId: string,
  ): Promise<RefreshToken> {
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const record = this.refreshTokenRepository.create({
      userId,
      tokenHash,
      familyId,
      expiresAt,
      isRevoked: false,
    });

    return this.refreshTokenRepository.save(record);
  }

  private async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const env = loadEnv();

    const organizerTenantId =
      user.organizerTenantId ??
      (user.role === UserRole.ORGANIZER ? user.id : null);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizerTenantId,
    };

    const accessToken = await this.jwtService.signAsync(
      { ...payload, type: "access" },
      {
        secret: env.JWT_SECRET,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTB-3 JwtSignOptions expiresIn string union
        expiresIn: env.JWT_EXPIRES_IN as any,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      { ...payload, jti: crypto.randomUUID(), type: "refresh" },
      {
        secret: env.JWT_REFRESH_SECRET,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- UTB-3 JwtSignOptions expiresIn string union
        expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
      },
    );

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizerTenantId: user.organizerTenantId,
      createdAt: user.createdAt,
    };
  }
}
