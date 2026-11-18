import { Test, TestingModule } from "@nestjs/testing";
import { UserRole } from "@urticketbuddy/contracts";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

describe("AuthController", () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  beforeEach(async () => {
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

      const result = await controller.register(dto);
      expect(service.register).toHaveBeenCalledWith(dto);
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

      const result = await controller.login(dto);
      expect(service.login).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResponse);
    });
  });
});
