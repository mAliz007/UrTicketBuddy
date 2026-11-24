import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { AuditService } from "./audit.service";
import { PlatformSettingsService } from "./platform-settings.service";
import {
  DATA_SOURCE,
  ORDER_REPOSITORY,
  TICKET_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  USER_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
} from "../../database/database.tokens";
import {
  OrderStatus,
  TicketStatus,
  SeatState,
  UserRole,
} from "@urticketbuddy/contracts";

describe("AdminService (Unit Tests)", () => {
  let service: AdminService;

  const mockOrderRepo = {
    findOne: jest.fn(),
    save: jest.fn((o) => Promise.resolve(o)),
  };

  const mockTicketRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn((t) => Promise.resolve(t)),
  };

  const mockEventSeatRepo = {
    findOne: jest.fn(),
    save: jest.fn((s) => Promise.resolve(s)),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn((u) => Promise.resolve(u)),
  };

  const mockRefreshTokenRepo = {
    update: jest.fn().mockResolvedValue({ affected: 2 }),
  };

  const mockTransactionManager = {
    save: jest.fn((_, entityOrEntities) => Promise.resolve(entityOrEntities)),
  };

  const mockDataSource = {
    transaction: jest.fn(async (cb: (mgr: any) => Promise<any>) =>
      cb(mockTransactionManager),
    ),
  };

  const mockRedisClient = {
    publish: jest.fn().mockResolvedValue(1),
  };

  const mockRedisScriptsWrapper = {
    unsellSeats: jest.fn().mockResolvedValue({ success: true, ok: true }),
  };

  const mockAuditService = {
    recordLog: jest.fn().mockResolvedValue({ id: "audit-1" }),
    getLogs: jest
      .fn()
      .mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 }),
  };

  const mockPlatformSettingsService = {
    getCommissionRate: jest.fn().mockResolvedValue(10),
    setCommissionRate: jest.fn().mockResolvedValue(undefined),
  };

  const adminActor = {
    id: "admin-id-1",
    email: "admin@urticketbuddy.local",
    role: UserRole.ADMIN,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: DATA_SOURCE, useValue: mockDataSource },
        { provide: ORDER_REPOSITORY, useValue: mockOrderRepo },
        { provide: TICKET_REPOSITORY, useValue: mockTicketRepo },
        { provide: EVENT_SEAT_REPOSITORY, useValue: mockEventSeatRepo },
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: REFRESH_TOKEN_REPOSITORY, useValue: mockRefreshTokenRepo },
        { provide: REDIS_CLIENT, useValue: mockRedisClient },
        { provide: REDIS_SCRIPTS_WRAPPER, useValue: mockRedisScriptsWrapper },
        { provide: AuditService, useValue: mockAuditService },
        {
          provide: PlatformSettingsService,
          useValue: mockPlatformSettingsService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe("flagOrder", () => {
    it("should mark order as FLAGGED, increment seedVersion on all tickets, and record audit log", async () => {
      const order = { id: "order-1", status: OrderStatus.COMPLETED };
      const tickets = [
        { id: "ticket-1", orderId: "order-1", seedVersion: 1 },
        { id: "ticket-2", orderId: "order-1", seedVersion: 2 },
      ];

      mockOrderRepo.findOne.mockResolvedValue(order);
      mockTicketRepo.find.mockResolvedValue(tickets);

      const result = await service.flagOrder(
        "order-1",
        adminActor,
        "Suspected fraudulent purchase",
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe(OrderStatus.FLAGGED);
      expect(result.invalidatedTicketsCount).toBe(2);
      expect(order.status).toBe(OrderStatus.FLAGGED);
      expect(tickets[0].seedVersion).toBe(2);
      expect(tickets[1].seedVersion).toBe(3);
      expect(mockTransactionManager.save).toHaveBeenCalled();
      expect(mockAuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORDER_FLAGGED",
          entityType: "Order",
          entityId: "order-1",
        }),
        mockTransactionManager,
      );
    });

    it("should return early and be idempotent if order is already FLAGGED", async () => {
      const order = { id: "order-1", status: OrderStatus.FLAGGED };
      mockOrderRepo.findOne.mockResolvedValue(order);

      const result = await service.flagOrder("order-1", adminActor);

      expect(result.success).toBe(true);
      expect(result.status).toBe(OrderStatus.FLAGGED);
      expect(result.invalidatedTicketsCount).toBe(0);
      expect(mockTicketRepo.find).not.toHaveBeenCalled();
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockAuditService.recordLog).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException if order does not exist", async () => {
      mockOrderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.flagOrder("non-existent-order", adminActor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("revokeTicket", () => {
    it("should revoke ticket, reset seat in Postgres and Redis, publish update, and audit", async () => {
      const ticket = {
        id: "ticket-123",
        eventId: "event-1",
        eventSeatId: "seat-pk-1",
        status: TicketStatus.ISSUED,
        seedVersion: 1,
        eventSeat: {
          id: "seat-pk-1",
          seatId: "A-1-5",
          status: SeatState.SOLD,
        },
      };

      mockTicketRepo.findOne.mockResolvedValue(ticket);

      const result = await service.revokeTicket(
        "ticket-123",
        adminActor,
        "Disputed payment",
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe(TicketStatus.REVOKED);
      expect(ticket.status).toBe(TicketStatus.REVOKED);
      expect(ticket.seedVersion).toBe(2);
      expect(ticket.eventSeat.status).toBe(SeatState.AVAILABLE);
      expect(mockTransactionManager.save).toHaveBeenCalled();
      expect(mockRedisScriptsWrapper.unsellSeats).toHaveBeenCalledWith(
        "event-1",
        ["A-1-5"],
      );
      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        "seat-updates:event-1",
        expect.stringContaining("AVAILABLE"),
      );
      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        "seat.state",
        expect.stringContaining("AVAILABLE"),
      );
      expect(mockAuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "TICKET_REVOKED",
          entityType: "Ticket",
          entityId: "ticket-123",
        }),
        mockTransactionManager,
      );
    });

    it("should throw NotFoundException if ticket does not exist", async () => {
      mockTicketRepo.findOne.mockResolvedValue(null);

      await expect(
        service.revokeTicket("non-existent", adminActor),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException if ticket is already REVOKED", async () => {
      mockTicketRepo.findOne.mockResolvedValue({
        id: "revoked-ticket",
        status: TicketStatus.REVOKED,
      });

      await expect(
        service.revokeTicket("revoked-ticket", adminActor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("approveOrganizer", () => {
    it("should assign ORGANIZER role and organizerTenantId if missing", async () => {
      const user = {
        id: "user-1",
        email: "organizer@example.com",
        role: UserRole.CUSTOMER,
        organizerTenantId: null,
      };

      mockUserRepo.findOne.mockResolvedValue(user);

      const result = await service.approveOrganizer("user-1", adminActor);

      expect(result.success).toBe(true);
      expect(result.role).toBe(UserRole.ORGANIZER);
      expect(result.organizerTenantId).toBeDefined();
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(mockAuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORGANIZER_APPROVED",
          entityId: "user-1",
        }),
      );
    });
  });

  describe("suspendUser", () => {
    it("should revoke all active refresh tokens and write audit log", async () => {
      const user = {
        id: "user-suspend",
        email: "baduser@example.com",
        role: UserRole.CUSTOMER,
        isSuspended: false,
      };

      mockUserRepo.findOne.mockResolvedValue(user);

      const result = await service.suspendUser("user-suspend", adminActor);

      expect(result.success).toBe(true);
      expect(result.suspended).toBe(true);
      expect(user.isSuspended).toBe(true);
      expect(mockUserRepo.save).toHaveBeenCalledWith(user);
      expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
        { userId: "user-suspend", isRevoked: false },
        { isRevoked: true },
      );
      expect(mockAuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "USER_SUSPENDED",
          entityId: "user-suspend",
        }),
      );
    });
  });

  describe("commission settings", () => {
    it("should read commission settings", async () => {
      mockPlatformSettingsService.getCommissionRate.mockResolvedValue(15);

      const result = await service.getCommissionSettings();
      expect(result.commissionRatePercent).toBe(15);
      expect(result.value).toBe("15");
    });

    it("should update commission rate and write audit log", async () => {
      const result = await service.updateCommissionRate(20, adminActor);
      expect(result.commissionRatePercent).toBe(20);
      expect(
        mockPlatformSettingsService.setCommissionRate,
      ).toHaveBeenCalledWith(20);
      expect(mockAuditService.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "COMMISSION_RATE_UPDATED",
          entityId: "commission_rate_percent",
        }),
      );
    });

    it("should reject commission rate outside 0-50 percent", async () => {
      await expect(
        service.updateCommissionRate(55, adminActor),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateCommissionRate(-5, adminActor),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
