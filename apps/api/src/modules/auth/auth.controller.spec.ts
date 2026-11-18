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
    it("should call authService.register and return the response", async () => {
      const dto = {
        email: "test@example.com",
        password: "Password123!",
        firstName: "Test",
        lastName: "User",
        role: UserRole.CUSTOMER,
      };

      const expectedResponse = {
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

      mockAuthService.register.mockResolvedValue(expectedResponse);

      const result = await controller.register(dto, mockResponse);
      expect(service.register).toHaveBeenCalledWith(dto, mockResponse);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("login", () => {
    it("should call authService.login and return the response", async () => {
      const dto = {
        email: "test@example.com",
        password: "Password123!",
      };

      const expectedResponse = {
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

      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(dto, mockResponse);
      expect(service.login).toHaveBeenCalledWith(dto, mockResponse);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("refresh", () => {
    it("should extract token from cookies and call authService.refresh", async () => {
      const req = {
        cookies: { refreshToken: "cookie-refresh-token" },
      } as unknown as Request;

      const expectedResponse = {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      };

      mockAuthService.refresh.mockResolvedValue(expectedResponse);

      const result = await controller.refresh(req, undefined, mockResponse);
      expect(service.refresh).toHaveBeenCalledWith(
        "cookie-refresh-token",
        mockResponse,
      );
      expect(result).toEqual(expectedResponse);
    });

    it("should extract token from body if not in cookies", async () => {
      const req = {
        cookies: {},
      } as unknown as Request;

      const expectedResponse = {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      };

      mockAuthService.refresh.mockResolvedValue(expectedResponse);

      const result = await controller.refresh(
        req,
        "body-refresh-token",
        mockResponse,
      );
      expect(service.refresh).toHaveBeenCalledWith(
        "body-refresh-token",
        mockResponse,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("logout", () => {
    it("should call authService.logout with token and clear cookies", async () => {
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
