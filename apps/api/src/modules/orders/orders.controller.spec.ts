import { Test, TestingModule } from "@nestjs/testing";
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

  it("should call ordersService.checkout with merged userId from header", async () => {
    const dto = {
      eventId: "a0000000-0000-0000-0000-000000000001",
      seatIds: ["SEC-A-1"],
      paymentMethodToken: "tok_visa",
    };
    const expectedResult = {
      id: "ord-1",
      userId: "usr-header",
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

    const result = await controller.checkout(dto, "usr-header");

    expect(service.checkout).toHaveBeenCalledWith({
      ...dto,
      userId: "usr-header",
    });
    expect(result).toEqual(expectedResult);
  });

  it("should call ordersService.getOrderById", async () => {
    const expectedOrder = { id: "ord-1", status: "COMPLETED" };
    mockOrdersService.getOrderById.mockResolvedValue(expectedOrder);

    const result = await controller.getOrderById("ord-1");

    expect(service.getOrderById).toHaveBeenCalledWith("ord-1");
    expect(result).toEqual(expectedOrder);
  });
});
