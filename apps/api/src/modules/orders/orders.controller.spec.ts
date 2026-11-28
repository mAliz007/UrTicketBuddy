import { Test, TestingModule } from "@nestjs/testing";
import { AuthUser, UserRole } from "@urticketbuddy/contracts";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

describe("OrdersController", () => {
  let controller: OrdersController;
  let service: OrdersService;

  const mockOrdersService = {
    checkout: jest.fn(),
    getOrderById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
    expect(service).toBeDefined();
  });

  it("should call ordersService.checkout with authenticated user.id from JWT", async () => {
    const dto = {
      eventId: "a0000000-0000-0000-0000-000000000001",
      seatIds: ["SEC-A-1"],
      paymentMethodToken: "tok_visa",
    };
    const user: AuthUser = {
      id: "usr-jwt-1",
      email: "buyer@example.com",
      firstName: "Buyer",
      lastName: "One",
      role: UserRole.CUSTOMER,
      createdAt: new Date(),
    };
    const expectedResult = {
      id: "ord-1",
      userId: "usr-jwt-1",
      eventId: dto.eventId,
      totalAmount: 1000,
      currency: "PKR",
      status: "COMPLETED",
      paymentGatewayRef: "txn-1",
      items: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockOrdersService.checkout.mockResolvedValue(expectedResult);

    const result = await controller.checkout(user, dto, "idem-123");

    expect(service.checkout).toHaveBeenCalledWith("usr-jwt-1", {
      ...dto,
      idempotencyKey: "idem-123",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should call ordersService.getOrderById with caller user context", async () => {
    const user: AuthUser = {
      id: "usr-jwt-1",
      email: "buyer@example.com",
      firstName: "Buyer",
      lastName: "One",
      role: UserRole.CUSTOMER,
      createdAt: new Date(),
    };
    const expectedOrder = { id: "ord-1", status: "COMPLETED" };
    mockOrdersService.getOrderById.mockResolvedValue(expectedOrder);

    const result = await controller.getOrderById("ord-1", user);

    expect(service.getOrderById).toHaveBeenCalledWith("ord-1", user);
    expect(result).toEqual(expectedOrder);
  });
});
