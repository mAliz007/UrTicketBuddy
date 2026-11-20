import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@urticketbuddy/contracts";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import {
  USER_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
} from "../../database/database.tokens";

describe("AuthService", () => {
  let service: AuthService;

  const mockUser = {
    id: "usr-1234-5678",
    email: "john@example.com",
    passwordHash: "",
    firstName: "John",
    lastName: "Doe",
    role: UserRole.CUSTOMER,
    organizerTenantId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRefreshTokenRepository = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((dto) => Promise.resolve(dto)),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockImplementation((payload, _options) => {
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
          provide: REFRESH_TOKEN_REPOSITORY,
          useValue: mockRefreshTokenRepository,
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
      expect(mockRefreshTokenRepository.save).toHaveBeenCalled();
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
  });

  describe("refresh (token rotation & reuse detection)", () => {
    it("should successfully rotate refresh token and issue new token pair", async () => {
      const stored = {
        id: "rt-1",
        userId: mockUser.id,
        tokenHash: "hash-val",
        familyId: "fam-1",
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
      };
      mockRefreshTokenRepository.findOne.mockResolvedValue(stored);
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.refresh("some-refresh-token");
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(stored.isRevoked).toBe(true);
      expect(mockRefreshTokenRepository.save).toHaveBeenCalled();
    });

    it("should trigger family revocation if an already-revoked token is reused", async () => {
      const stored = {
        id: "rt-1",
        userId: mockUser.id,
        tokenHash: "hash-val",
        familyId: "fam-1",
        isRevoked: true,
        expiresAt: new Date(Date.now() + 1000000),
      };
      mockRefreshTokenRepository.findOne.mockResolvedValue(stored);

      await expect(service.refresh("reused-token")).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockRefreshTokenRepository.update).toHaveBeenCalledWith(
        { familyId: "fam-1" },
        { isRevoked: true },
      );
    });
  });

  describe("gate staff provisioning", () => {
    it("should allow organizer to provision gate staff", async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation((dto) => ({
        id: "staff-1",
        ...dto,
      }));
      mockUserRepository.save.mockImplementation((entity) =>
        Promise.resolve(entity),
      );

      const creator = {
        id: "org-1",
        email: "org@example.com",
        firstName: "Organizer",
        lastName: "Boss",
        role: UserRole.ORGANIZER,
        organizerTenantId: "tenant-1",
        createdAt: new Date(),
      };

      const staff = await service.createGateStaff(creator, {
        email: "scanner@example.com",
        password: "StaffPassword123!",
        firstName: "Staff",
        lastName: "Scanner",
      });

      expect(staff.email).toBe("scanner@example.com");
      expect(staff.role).toBe(UserRole.GATE_STAFF);
      expect(staff.organizerTenantId).toBe("tenant-1");
    });
  });

  describe("profile management", () => {
    it("should update user profile", async () => {
      const user = { ...mockUser };
      mockUserRepository.findOne.mockResolvedValue(user);
      mockUserRepository.save.mockImplementation((u) => Promise.resolve(u));

      const updated = await service.updateProfile(user.id, {
        firstName: "Johnny",
        lastName: "Updated",
      });

      expect(updated.firstName).toBe("Johnny");
      expect(updated.lastName).toBe("Updated");
    });

    it("should throw NotFoundException if user is not found", async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile("unknown", { firstName: "Test" }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
