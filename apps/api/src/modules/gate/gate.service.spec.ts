import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { GateService } from "./gate.service";
import {
  TICKET_REPOSITORY,
  GATE_SCAN_REPOSITORY,
  EVENT_REPOSITORY,
  REDIS_CLIENT,
} from "../../database/database.tokens";
import { BloomService } from "../../common/bloom/bloom.service";
import { TicketsService } from "../tickets/tickets.service";
import { TicketStatus, ScanResult, UserRole } from "@urticketbuddy/contracts";
import { Ticket } from "@urticketbuddy/db";

describe("GateService", () => {
  let service: GateService;
  let mockTicketRepo: any;
  let mockGateScanRepo: any;
  let mockEventRepo: any;
  let mockRedisClient: any;
  let mockBloomService: any;
  let mockTicketsService: any;

  const eventId = "11111111-1111-1111-1111-111111111111";
  const otherEventId = "99999999-9999-9999-9999-999999999999";
  const organizerId = "organizer-tenant-123";

  const sampleTicket: Ticket = {
    id: "00000000-0000-0000-0000-000000000001",
    eventId,
    eventSeatId: "22222222-2222-2222-2222-222222222222",
    orderId: "33333333-3333-3333-3333-333333333333",
    ownerId: "user-123",
    status: TicketStatus.ISSUED,
    seedVersion: 1,
    faceValueMinor: 100000,
    createdAt: new Date(),
    updatedAt: new Date(),
    event: null as any,
    eventSeat: null as any,
    order: null as any,
  };

  const validWindow = Math.floor(Date.now() / 1000 / 30);
  const validToken = Buffer.from(
    `${sampleTicket.id}.${validWindow}.mockhmac123`,
  ).toString("base64url");

  beforeEach(async () => {
    mockTicketRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        if (where.id === sampleTicket.id) {
          return { ...sampleTicket };
        }
        return null;
      }),
      update: jest.fn(async ({ id, status }: any) => {
        if (id === sampleTicket.id && status === TicketStatus.ISSUED) {
          return { affected: 1 };
        }
        return { affected: 0 };
      }),
    };

    mockEventRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        if (where.id === eventId || where.id === otherEventId) {
          return {
            id: where.id,
            organizerId,
            title: "Test Event",
          };
        }
        return null;
      }),
    };

    mockGateScanRepo = {
      create: jest.fn((dto: any) => ({
        id: "scan-uuid-123",
        scannedAt: new Date(),
        ...dto,
      })),
      save: jest.fn(async (entity: any) => entity),
      count: jest.fn(async () => 10),
    };

    mockRedisClient = {
      set: jest.fn(async () => "OK"), // "OK" on NX success, null on duplicate
      del: jest.fn(async () => 1),
      exists: jest.fn(async () => 1),
    };

    mockBloomService = {
      mightExist: jest.fn(async () => true),
    };

    mockTicketsService = {
      verifyToken: jest.fn(() => ({
        valid: true,
        window: validWindow,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GateService,
        {
          provide: TICKET_REPOSITORY,
          useValue: mockTicketRepo,
        },
        {
          provide: GATE_SCAN_REPOSITORY,
          useValue: mockGateScanRepo,
        },
        {
          provide: EVENT_REPOSITORY,
          useValue: mockEventRepo,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedisClient,
        },
        {
          provide: BloomService,
          useValue: mockBloomService,
        },
        {
          provide: TicketsService,
          useValue: mockTicketsService,
        },
      ],
    }).compile();

    service = module.get<GateService>(GateService);
  });

  describe("scanTicket", () => {
    it("should successfully validate and check in an ISSUED ticket", async () => {
      const res = await service.scanTicket(
        { token: validToken, eventId },
        "scanner-staff-1",
      );

      expect(res.result).toBe(ScanResult.VALID);
      expect(res.ticketId).toBe(sampleTicket.id);
      expect(res.eventId).toBe(eventId);
      expect(res.seatId).toBe(sampleTicket.eventSeatId);

      // Verify Bloom filter checked
      expect(mockBloomService.mightExist).toHaveBeenCalledWith(sampleTicket.id);

      // Verify PostgreSQL queried
      expect(mockTicketRepo.findOne).toHaveBeenCalled();

      // Verify concurrency scan lock and replay protection acquired
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `scan_lock:${sampleTicket.id}`,
        "1",
        "EX",
        5,
        "NX",
      );
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `qr_nonce:${sampleTicket.id}:${validWindow}`,
        "1",
        "EX",
        60,
        "NX",
      );

      // Verify status atomically updated to CHECKED_IN with seedVersion
      expect(mockTicketRepo.update).toHaveBeenCalledWith(
        {
          id: sampleTicket.id,
          status: TicketStatus.ISSUED,
          seedVersion: sampleTicket.seedVersion,
        },
        { status: TicketStatus.CHECKED_IN },
      );

      // Verify scan_lock deleted in finally
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `scan_lock:${sampleTicket.id}`,
      );

      // Verify gate scan recorded as VALID with foreign key and ref
      expect(mockGateScanRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: sampleTicket.id,
          scannedTicketRef: sampleTicket.id,
          eventId,
          scannedBy: "scanner-staff-1",
          result: ScanResult.VALID,
        }),
      );
    });

    it("should reject forged ticket at Bloom filter with ZERO PostgreSQL queries and safe null FK", async () => {
      // Bloom filter returns false (definite miss)
      mockBloomService.mightExist.mockResolvedValueOnce(false);

      const forgedTicketId = "00000000-0000-0000-0000-999999999999";
      const forgedToken = Buffer.from(
        `${forgedTicketId}.${validWindow}.fakehmac`,
      ).toString("base64url");

      await expect(
        service.scanTicket({ token: forgedToken, eventId }, "scanner-staff-1"),
      ).rejects.toThrow(BadRequestException);

      // Assert PostgreSQL repository findOne was NEVER called
      expect(mockTicketRepo.findOne).not.toHaveBeenCalled();

      // Assert audit scan was logged with ticketId: null (avoid FK violation) and scannedTicketRef
      expect(mockGateScanRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: null,
          scannedTicketRef: forgedTicketId,
          result: ScanResult.INVALID,
        }),
      );
    });

    it("should reject scan if ticket belongs to a different event", async () => {
      await expect(
        service.scanTicket(
          { token: validToken, eventId: otherEventId },
          "scanner-staff-1",
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockGateScanRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          result: ScanResult.WRONG_EVENT,
        }),
      );
    });

    it("should reject expired token window with 400 and record EXPIRED", async () => {
      mockTicketsService.verifyToken.mockReturnValueOnce({
        valid: false,
        isExpired: true,
        reason: "Token window expired",
      });

      await expect(
        service.scanTicket({ token: validToken, eventId }, "scanner-staff-1"),
      ).rejects.toThrow(BadRequestException);

      expect(mockGateScanRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          result: ScanResult.EXPIRED,
        }),
      );
    });

    it("should reject with 409 Conflict if another turnstile holds the active scan lock", async () => {
      // scan_lock fails (null)
      mockRedisClient.set.mockResolvedValueOnce(null);

      await expect(
        service.scanTicket({ token: validToken, eventId }, "scanner-staff-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("should reject replay scan within 60s window with 409 Conflict", async () => {
      // scan_lock succeeds, qr_nonce returns null (already set)
      mockRedisClient.set
        .mockResolvedValueOnce("OK") // scan_lock
        .mockResolvedValueOnce(null); // qr_nonce

      await expect(
        service.scanTicket({ token: validToken, eventId }, "scanner-staff-1"),
      ).rejects.toThrow(ConflictException);

      expect(mockGateScanRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          result: ScanResult.USED,
        }),
      );
    });

    it("should reject if ticket is already CHECKED_IN with 409 Conflict", async () => {
      mockTicketRepo.findOne.mockResolvedValueOnce({
        ...sampleTicket,
        status: TicketStatus.CHECKED_IN,
      });

      await expect(
        service.scanTicket({ token: validToken, eventId }, "scanner-staff-1"),
      ).rejects.toThrow(ConflictException);

      expect(mockGateScanRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          result: ScanResult.USED,
        }),
      );
    });

    it("should reject REVOKED ticket with 409 Conflict and record INVALID", async () => {
      mockTicketRepo.findOne.mockResolvedValueOnce({
        ...sampleTicket,
        status: TicketStatus.REVOKED,
      });

      await expect(
        service.scanTicket({ token: validToken, eventId }, "scanner-staff-1"),
      ).rejects.toThrow(ConflictException);

      expect(mockGateScanRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          result: ScanResult.INVALID,
        }),
      );
    });

    it("should reject VOID ticket with 409 Conflict and record INVALID", async () => {
      mockTicketRepo.findOne.mockResolvedValueOnce({
        ...sampleTicket,
        status: TicketStatus.VOID,
      });

      await expect(
        service.scanTicket({ token: validToken, eventId }, "scanner-staff-1"),
      ).rejects.toThrow(ConflictException);

      expect(mockGateScanRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          result: ScanResult.INVALID,
        }),
      );
    });

    it("should reject scan with 400 Bad Request if seedVersion was rotated concurrently", async () => {
      // Update fails because seedVersion changed
      mockTicketRepo.update.mockResolvedValueOnce({ affected: 0 });
      // When refreshed from DB, seedVersion is 2 instead of 1
      mockTicketRepo.findOne
        .mockResolvedValueOnce({ ...sampleTicket }) // initial lookup
        .mockResolvedValueOnce({ ...sampleTicket, seedVersion: 2 }); // refreshed lookup

      await expect(
        service.scanTicket({ token: validToken, eventId }, "scanner-staff-1"),
      ).rejects.toThrow(BadRequestException);

      expect(mockGateScanRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          result: ScanResult.INVALID,
        }),
      );
    });

    it("should rollback Redis nonce if database update fails unexpectedly", async () => {
      mockTicketRepo.update.mockRejectedValueOnce(
        new Error("Database connection lost"),
      );

      await expect(
        service.scanTicket({ token: validToken, eventId }, "scanner-staff-1"),
      ).rejects.toThrow("Database connection lost");

      // Verify that Redis nonce was rolled back/deleted so the patron is not locked out
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `qr_nonce:${sampleTicket.id}:${validWindow}`,
      );
    });

    it("should enforce tenant isolation if scanner belongs to another organizer", async () => {
      await expect(
        service.scanTicket({ token: validToken, eventId }, "scanner-staff-1", {
          id: "intruder-scanner",
          role: UserRole.ORGANIZER,
          organizerTenantId: "different-tenant",
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("getMetrics", () => {
    it("should return scan statistics and entry velocity based on valid scans", async () => {
      mockGateScanRepo.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85) // valid
        .mockResolvedValueOnce(25); // recent 5 mins valid scans

      const metrics = await service.getMetrics(eventId);

      expect(metrics.eventId).toBe(eventId);
      expect(metrics.totalScans).toBe(100);
      expect(metrics.validScans).toBe(85);
      expect(metrics.rejectedScans).toBe(15);
      expect(metrics.entryVelocityPerMinute).toBe(5); // 25 / 5
    });
  });
});
