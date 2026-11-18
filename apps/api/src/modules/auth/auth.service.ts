import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { User } from "@urticketbuddy/db";
import { loadEnv } from "@urticketbuddy/config";
import {
  ErrorCode,
  UserRole,
  RegisterRequestSchema,
  RegisterRequest,
  LoginRequestSchema,
  LoginRequest,
  AuthResponse,
  AuthUser,
} from "@urticketbuddy/contracts";
import { USER_REPOSITORY } from "../../database/database.tokens";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const parsed = RegisterRequestSchema.safeParse(data);
    if (!parsed.success) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: "Invalid registration payload",
        details: parsed.error.issues,
      });
    }

    const { email, password, firstName, lastName, role } = parsed.data;

    // Check if user with this email already exists
    const existing = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException({
        code: ErrorCode.EMAIL_ALREADY_EXISTS,
        message: `User with email ${email} already exists`,
      });
    }

    // Hash password with bcrypt (salt rounds >= 10)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = this.userRepository.create({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      role: role || UserRole.CUSTOMER,
    });

    const savedUser = await this.userRepository.save(user);
    this.logger.log(`User registered: ${savedUser.id} (${savedUser.email})`);

    const tokens = await this.generateTokens(savedUser);

    return {
      user: this.sanitizeUser(savedUser),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
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

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: "Invalid email or password",
      });
    }

    this.logger.log(`User logged in: ${user.id} (${user.email})`);
    const tokens = await this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  private async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const env = loadEnv();

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
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
      { ...payload, type: "refresh" },
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
      createdAt: user.createdAt,
    };
  }
}
