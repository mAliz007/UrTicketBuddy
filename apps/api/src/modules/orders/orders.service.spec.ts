import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { UserRole } from "@urticketbuddy/contracts";
import { OrdersService, DEFAULT_SEAT_PRICE } from "./orders.service";
import { MockPaymentService } from "./payment/mock-payment.service";
import {
  DATA_SOURCE,
  ORDER_REPOSITORY,
  ORDER_ITEM_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
} from "../../database/database.tokens";

describe("OrdersService", () => {
  let service: OrdersService;
  let paymentService: MockPaymentService;

  const eventId = "b0000000-0000-0000-0000-000000000001";
  const userId = "usr-test-123";
  const seatId1 = "SEC-A-1";
  const seatId2 = "SEC-A-2";

  const mockSeats = [
    {
      id: "seat-uuid-1",
      eventId,
      seatId: seatId1,
      status: "HELD",
      x: 10,
      y: 10,
    },
    {
      id: "seat-uuid-2",
      eventId,
      seatId: seatId2,
      status: "HELD",
      x: 20,
      y: 20,
    },
  ];

  const mockOrderRepo = {
    findOne: jest.fn(),
  };

  const mockOrderItemRepo = {};

  const mockEventSeatRepo = {
    find: jest.fn(),
  };

  const mockRedisClient = {
    get: jest.fn(),
    publish: jest.fn().mockResolvedValue(1),
  };

  const mockRedisScripts = {
    getSnapshot: jest.fn(),
    confirmSold: jest.fn(),
    unsellSeats: jest.fn().mockResolvedValue({ success: true }),
  };

  const mockTransactionManager = {
    find: jest.fn(async () => [
      { id: "seat-uuid-1", status: "AVAILABLE" },
      { id: "seat-uuid-2", status: "AVAILABLE" },
    ]),
    create: jest.fn((entityClass, data) => ({
      id: "ord-new-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    })),
    save: jest.fn(async (entityClass, entity) => entity),
    update: jest.fn(async () => ({ affected: 2 })),
  };

  const mockDataSource = {
    transaction: jest.fn(async (cb) => cb(mockTransactionManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        MockPaymentService,
        {
          provide: DATA_SOURCE,
          useValue: mockDataSource,
        },
        {
          provide: ORDER_REPOSITORY,
          useValue: mockOrderRepo,
        },
        {
          provide: ORDER_ITEM_REPOSITORY,
          useValue: mockOrderItemRepo,
        },
        {
          provide: EVENT_SEAT_REPOSITORY,
          useValue: mockEventSeatRepo,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedisClient,
        },
        {
          provide: REDIS_SCRIPTS_WRAPPER,
          useValue: mockRedisScripts,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    paymentService = module.get<MockPaymentService>(MockPaymentService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("checkout", () => {
    it("should reject invalid checkout request payload", async () => {
      await expect(
        service.checkout(userId, {
          eventId: "invalid-uuid",
          seatIds: [],
          paymentMethodToken: "",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw ConflictException (HOLD_EXPIRED) if seat hold is not found in Redis", async () => {
      mockRedisScripts.getSnapshot.mockResolvedValue({
        holds: {},
      });
      mockRedisClient.get.mockResolvedValue(null);

      await expect(
        service.checkout(userId, {
          eventId,
          seatIds: [seatId1],
          paymentMethodToken: "tok_visa",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException (SEAT_NOT_HELD_BY_YOU) if hold belongs to another user", async () => {
      mockRedisScripts.getSnapshot.mockResolvedValue({
        holds: {
          [seatId1]: {
            userId: "someone-else",
            expiresAt: Date.now() + 100000,
          },
        },
      });

      await expect(
        service.checkout(userId, {
          eventId,
          seatIds: [seatId1],
          paymentMethodToken: "tok_visa",
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw BadRequestException if seat IDs are not found in Postgres", async () => {
      mockRedisScripts.getSnapshot.mockResolvedValue({
        holds: {
          [seatId1]: {
            userId,
            expiresAt: Date.now() + 100000,
          },
        },
      });
      mockEventSeatRepo.find.mockResolvedValue([]);

      await expect(
        service.checkout(userId, {
          eventId,
          seatIds: [seatId1],
          paymentMethodToken: "tok_visa",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException (PAYMENT_FAILED) if payment processing fails", async () => {
      mockRedisScripts.getSnapshot.mockResolvedValue({
        holds: {
          [seatId1]: {
            userId,
            expiresAt: Date.now() + 100000,
          },
        },
      });
      mockEventSeatRepo.find.mockResolvedValue([mockSeats[0]]);
      jest.spyOn(paymentService, "processPayment").mockResolvedValue({
        success: false,
        error: "Insufficient funds",
      });

      await expect(
        service.checkout(userId, {
          eventId,
          seatIds: [seatId1],
          paymentMethodToken: "tok_fail",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should issue compensating refund and throw ConflictException if Redis confirmSold returns failure", async () => {
      mockRedisScripts.getSnapshot.mockResolvedValue({
        holds: {
          [seatId1]: {
            userId,
            expiresAt: Date.now() + 100000,
          },
        },
      });
      mockEventSeatRepo.find.mockResolvedValue([mockSeats[0]]);
      jest.spyOn(paymentService, "processPayment").mockResolvedValue({
        success: true,
        transactionId: "txn_123",
      });
      const refundSpy = jest.spyOn(paymentService, "refundPayment");
      mockRedisScripts.confirmSold.mockResolvedValue({
        success: false,
        code: "SEAT_ALREADY_SOLD",
      });

      await expect(
        service.checkout(userId, {
          eventId,
          seatIds: [seatId1],
          paymentMethodToken: "tok_visa",
        }),
      ).rejects.toThrow(ConflictException);

      expect(refundSpy).toHaveBeenCalledWith({
        transactionId: "txn_123",
        amount: 1000,
        reason: "Seat confirmation failed: SEAT_ALREADY_SOLD",
      });
    });

    it("should issue compensating refund and unsell seats if database transaction fails", async () => {
      mockRedisScripts.getSnapshot.mockResolvedValue({
        holds: {
          [seatId1]: {
            userId,
            expiresAt: Date.now() + 100000,
          },
        },
      });
      mockEventSeatRepo.find.mockResolvedValue([mockSeats[0]]);
      jest.spyOn(paymentService, "processPayment").mockResolvedValue({
        success: true,
        transactionId: "txn_db_fail_123",
      });
      mockRedisScripts.confirmSold.mockResolvedValue({
        success: true,
        code: "OK",
        soldSeats: [seatId1],
      });
      const refundSpy = jest.spyOn(paymentService, "refundPayment");
      mockDataSource.transaction.mockRejectedValueOnce(
        new Error("Database deadlock"),
      );

      await expect(
        service.checkout(userId, {
          eventId,
          seatIds: [seatId1],
          paymentMethodToken: "tok_visa",
        }),
      ).rejects.toThrow("Database deadlock");

      expect(refundSpy).toHaveBeenCalledWith({
        transactionId: "txn_db_fail_123",
        amount: 1000,
        reason: expect.stringContaining("Database transaction failed"),
      });
      expect(mockRedisScripts.unsellSeats).toHaveBeenCalledWith(eventId, [
        seatId1,
      ]);
    });

    it("should successfully complete checkout, commit transaction, publish pub/sub events, and return order", async () => {
      mockRedisScripts.getSnapshot.mockResolvedValue({
        holds: {
          [seatId1]: {
            userId,
            expiresAt: Date.now() + 100000,
          },
          [seatId2]: {
            userId,
            expiresAt: Date.now() + 100000,
          },
        },
      });
      mockEventSeatRepo.find.mockResolvedValue(mockSeats);
      jest.spyOn(paymentService, "processPayment").mockResolvedValue({
        success: true,
        transactionId: "txn_test_abc",
      });
      mockRedisScripts.confirmSold.mockResolvedValue({
        success: true,
        code: "OK",
        soldSeats: [seatId1, seatId2],
      });

      const result = await service.checkout(userId, {
        eventId,
        seatIds: [seatId1, seatId2],
        paymentMethodToken: "tok_visa",
      });

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.eventId).toBe(eventId);
      expect(result.status).toBe("COMPLETED");
      expect(result.totalAmount).toBe(2 * DEFAULT_SEAT_PRICE);
      expect(result.paymentGatewayRef).toBe("txn_test_abc");
      expect(result.items).toHaveLength(2);

      // Verify transaction was called
      expect(mockDataSource.transaction).toHaveBeenCalled();

      // Verify Pub/Sub was published for each seat
      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        `seat-updates:${eventId}`,
        expect.stringContaining(`"state":"SOLD"`),
      );
      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        "seat.state",
        expect.stringContaining(`"state":"SOLD"`),
      );
    });
  });

  describe("getOrderById", () => {
    it("should return order if found for owner or ADMIN", async () => {
      const mockOrder = {
        id: "ord-1",
        userId,
        status: "COMPLETED",
        items: [],
      };
      mockOrderRepo.findOne.mockResolvedValue(mockOrder);

      const res = await service.getOrderById("ord-1", {
        id: userId,
        role: UserRole.CUSTOMER,
      });
      expect(res).toEqual(mockOrder);

      const adminRes = await service.getOrderById("ord-1", {
        id: "admin-1",
        role: UserRole.ADMIN,
      });
      expect(adminRes).toEqual(mockOrder);
    });

    it("should throw ForbiddenException if caller does not own the order", async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: "ord-1",
        userId,
        status: "COMPLETED",
        items: [],
      });

      await expect(
        service.getOrderById("ord-1", {
          id: "other-user",
          role: UserRole.CUSTOMER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw NotFoundException if order not found", async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);

      await expect(service.getOrderById("ord-missing")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
