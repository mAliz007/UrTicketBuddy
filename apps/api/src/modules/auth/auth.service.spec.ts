import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { UserRole } from "@urticketbuddy/contracts";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { USER_REPOSITORY } from "../../database/database.tokens";

describe("AuthService", () => {
  let service: AuthService;

  const mockUser = {
    id: "usr-1234-5678",
    email: "john@example.com",
    passwordHash: "",
    firstName: "John",
    lastName: "Doe",
    role: UserRole.CUSTOMER,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockImplementation((payload, options) => {
      return Promise.resolve(`jwt_token_${payload.type || "access"}`);
    }),
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash("Password123!", 10);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("register", () => {
    it("should successfully register a new user and return tokens", async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation((dto) => ({
        id: mockUser.id,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
        ...dto,
      }));
      mockUserRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const result = await service.register({
        email: "john@example.com",
        password: "Password123!",
        firstName: "John",
        lastName: "Doe",
        role: UserRole.CUSTOMER,
      });

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: "john@example.com" },
      });
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result.user.email).toBe("john@example.com");
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it("should throw ConflictException if email is already taken", async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: "john@example.com",
          password: "Password123!",
          firstName: "John",
          lastName: "Doe",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw BadRequestException if payload fails validation", async () => {
      await expect(
        service.register({
          email: "invalid-email",
          password: "short",
          firstName: "",
          lastName: "",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("login", () => {
    it("should successfully authenticate user with valid credentials", async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.login({
        email: "john@example.com",
        password: "Password123!",
      });

      expect(result.user.email).toBe(mockUser.email);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it("should throw UnauthorizedException if user is not found", async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: "nonexistent@example.com",
          password: "Password123!",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException if password is incorrect", async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.login({
          email: "john@example.com",
          password: "WrongPassword!",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw BadRequestException if login payload is malformed", async () => {
      await expect(
        service.login({
          email: "not-an-email",
          password: "",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
