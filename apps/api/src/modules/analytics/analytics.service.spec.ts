import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import {
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  TICKET_REPOSITORY,
  ORDER_REPOSITORY,
  GATE_SCAN_REPOSITORY,
  REDIS_SCRIPTS_WRAPPER,
} from "../../database/database.tokens";
import { UserRole } from "@urticketbuddy/contracts";

describe("AnalyticsService (Unit Tests)", () => {
  let service: AnalyticsService;

  const mockEventRepo = {
    findOne: jest.fn(),
  };

  const mockEventSeatRepo = {
    count: jest.fn(),
  };

  const mockTicketRepo = {
    count: jest.fn(),
  };

  const mockOrderRepo = {
    find: jest.fn(),
  };

  const mockGateScanRepo = {
    find: jest.fn(),
  };

  const mockRedisScriptsWrapper = {
    getCounts: jest.fn(),
  };

  const eventId = "event-uuid-100";
  const organizerTenantId = "tenant-uuid-1";

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: EVENT_REPOSITORY, useValue: mockEventRepo },
        { provide: EVENT_SEAT_REPOSITORY, useValue: mockEventSeatRepo },
        { provide: TICKET_REPOSITORY, useValue: mockTicketRepo },
        { provide: ORDER_REPOSITORY, useValue: mockOrderRepo },
        { provide: GATE_SCAN_REPOSITORY, useValue: mockGateScanRepo },
        { provide: REDIS_SCRIPTS_WRAPPER, useValue: mockRedisScriptsWrapper },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it("should calculate event analytics for matching organizer", async () => {
    mockEventRepo.findOne.mockResolvedValue({
      id: eventId,
      name: "Rock Concert",
      organizerId: organizerTenantId,
    });

    mockEventSeatRepo.count.mockResolvedValue(100);
    mockTicketRepo.count.mockResolvedValue(80);
    mockOrderRepo.find.mockResolvedValue([
      { totalAmount: 50000 },
      { totalAmount: 30000 },
    ]);

    const now = Date.now();
    mockGateScanRepo.find.mockResolvedValue([
      { scannedAt: new Date(now - 12 * 60 * 1000), result: "VALID" },
      { scannedAt: new Date(now - 11 * 60 * 1000), result: "VALID" },
      { scannedAt: new Date(now - 4 * 60 * 1000), result: "VALID" },
    ]);

    mockRedisScriptsWrapper.getCounts.mockResolvedValue({
      held: 10,
      sold: 80,
    });

    const result = await service.getEventAnalytics(eventId, {
      id: "org-user-1",
      role: UserRole.ORGANIZER,
      organizerTenantId,
    });

    expect(result.eventId).toBe(eventId);
    expect(result.totalCapacity).toBe(100);
    expect(result.ticketsSold).toBe(80);
    expect(result.occupancyRate).toBe(80);
    expect(result.totalRevenue).toBe(80000);
    expect(result.holdStats).toEqual({ held: 10, sold: 80 });
    expect(result.resaleStats).toBeDefined();
    expect(result.entryVelocity.length).toBeGreaterThan(0);
  });

  it("should allow ADMIN to bypass tenant ownership checks", async () => {
    mockEventRepo.findOne.mockResolvedValue({
      id: eventId,
      name: "Rock Concert",
      organizerId: "other-tenant",
    });

    mockEventSeatRepo.count.mockResolvedValue(50);
    mockTicketRepo.count.mockResolvedValue(10);
    mockOrderRepo.find.mockResolvedValue([]);
    mockGateScanRepo.find.mockResolvedValue([]);
    mockRedisScriptsWrapper.getCounts.mockResolvedValue({ held: 0, sold: 10 });

    const result = await service.getEventAnalytics(eventId, {
      id: "admin-user",
      role: UserRole.ADMIN,
      organizerTenantId: "different-tenant",
    });

    expect(result).toBeDefined();
    expect(result.totalCapacity).toBe(50);
  });

  it("should throw ForbiddenException if ORGANIZER does not own the event", async () => {
    mockEventRepo.findOne.mockResolvedValue({
      id: eventId,
      name: "Rock Concert",
      organizerId: "another-tenant-999",
    });

    await expect(
      service.getEventAnalytics(eventId, {
        id: "intruder-org",
        role: UserRole.ORGANIZER,
        organizerTenantId: "my-tenant-111",
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("should throw NotFoundException if event does not exist", async () => {
    mockEventRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getEventAnalytics("missing-event", {
        id: "admin",
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
