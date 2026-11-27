import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { UserRole } from "@urticketbuddy/contracts";
import type { Request, Response } from "express";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
  let controller: AuthController;
  let service: AuthService;

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as unknown as Response;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    setRefreshTokenCookie: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("register", () => {
    it("should call authService.register and strip refreshToken from JSON body", async () => {
      const dto = {
        email: "test@example.com",
        password: "Password123!",
        firstName: "Test",
        lastName: "User",
        role: UserRole.CUSTOMER,
      };

      const serviceResponse = {
        user: {
          id: "uuid-1",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          role: UserRole.CUSTOMER,
          createdAt: new Date(),
        },
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      };

      mockAuthService.register.mockResolvedValue(serviceResponse);

      const result = await controller.register(dto, mockResponse);
      expect(service.register).toHaveBeenCalledWith(dto, mockResponse);
      expect(result).toEqual({
        user: serviceResponse.user,
        accessToken: "mock-access-token",
      });
      expect((result as Record<string, unknown>).refreshToken).toBeUndefined();
    });
  });

  describe("login", () => {
    it("should call authService.login and strip refreshToken from JSON body", async () => {
      const dto = {
        email: "test@example.com",
        password: "Password123!",
      };

      const serviceResponse = {
        user: {
          id: "uuid-1",
          email: "test@example.com",
          firstName: "Test",
          lastName: "User",
          role: UserRole.CUSTOMER,
          createdAt: new Date(),
        },
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
      };

      mockAuthService.login.mockResolvedValue(serviceResponse);

      const result = await controller.login(dto, mockResponse);
      expect(service.login).toHaveBeenCalledWith(dto, mockResponse);
      expect(result).toEqual({
        user: serviceResponse.user,
        accessToken: "mock-access-token",
      });
      expect((result as Record<string, unknown>).refreshToken).toBeUndefined();
    });
  });

  describe("refresh", () => {
    it("should extract token from cookies, call authService.refresh, and strip refreshToken from JSON body", async () => {
      const req = {
        cookies: { refreshToken: "cookie-refresh-token" },
        headers: {},
      } as unknown as Request;

      const serviceResponse = {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      };

      mockAuthService.refresh.mockResolvedValue(serviceResponse);

      const result = await controller.refresh(req, undefined, mockResponse);
      expect(service.refresh).toHaveBeenCalledWith(
        "cookie-refresh-token",
        mockResponse,
      );
      expect(result).toEqual({ accessToken: "new-access-token" });
      expect((result as Record<string, unknown>).refreshToken).toBeUndefined();
    });

    it("should reject refresh token passed in JSON request body (F-7)", async () => {
      const req = {
        cookies: {},
        headers: {},
      } as unknown as Request;

      await expect(
        controller.refresh(req, "body-refresh-token", mockResponse),
      ).rejects.toThrow(UnauthorizedException);
      expect(service.refresh).not.toHaveBeenCalled();
    });

    it("should reject CSRF mismatches on refresh endpoint (F-7)", async () => {
      const req = {
        cookies: {
          refreshToken: "cookie-refresh-token",
          "XSRF-TOKEN": "csrf-secret-1",
        },
        headers: {
          "x-csrf-token": "wrong-csrf-token",
        },
      } as unknown as Request;

      await expect(
        controller.refresh(req, undefined, mockResponse),
      ).rejects.toThrow(ForbiddenException);
      expect(service.refresh).not.toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("should call authService.logout with cookie token and clear cookies", async () => {
      const req = {
        cookies: { refreshToken: "logout-token" },
      } as unknown as Request;

      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(req, undefined, mockResponse);
      expect(service.logout).toHaveBeenCalledWith("logout-token", mockResponse);
      expect(result).toEqual({ success: true });
    });
  });
});
