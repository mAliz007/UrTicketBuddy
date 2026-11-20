import { Test, TestingModule } from "@nestjs/testing";
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { TicketsService } from "./tickets.service";
import { TICKET_REPOSITORY } from "../../database/database.tokens";
import { TicketStatus, UserRole } from "@urticketbuddy/contracts";
import { Ticket } from "@urticketbuddy/db";

describe("TicketsService", () => {
  let service: TicketsService;
  let mockTicketRepo: any;

  const sampleTicket: Ticket = {
    id: "00000000-0000-0000-0000-000000000001",
    eventId: "11111111-1111-1111-1111-111111111111",
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

  beforeEach(async () => {
    mockTicketRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        if (where.id === sampleTicket.id) {
          return { ...sampleTicket };
        }
        return null;
      }),
      save: jest.fn(async (ticket: any) => ticket),
      find: jest.fn(async ({ where }: any) => {
        if (where.ownerId === sampleTicket.ownerId) {
          return [{ ...sampleTicket }];
        }
        return [];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: TICKET_REPOSITORY,
          useValue: mockTicketRepo,
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  describe("HKDF Key Derivation and HMAC Token Generation (Decision D-3)", () => {
    it("should derive a 32-byte key reproducibly for a ticket and seedVersion", () => {
      const key1 = service.deriveKey(sampleTicket.id, 1);
      const key2 = service.deriveKey(sampleTicket.id, 1);
      const keyDiffSeed = service.deriveKey(sampleTicket.id, 2);

      expect(key1).toHaveLength(32);
      expect(key1.equals(key2)).toBe(true);
      expect(key1.equals(keyDiffSeed)).toBe(false);
    });

    it("should generate a 30-second time-decaying dynamic token", () => {
      const fixedTime = 1700000000000; // ms
      const { token, expiresAt, window } = service.generateDynamicToken(
        sampleTicket.id,
        1,
        fixedTime,
      );

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(window).toBe(Math.floor(fixedTime / 1000 / 30));
      expect(new Date(expiresAt).getTime()).toBe((window + 1) * 30 * 1000);

      // Verify token payload decodes to ticketId.window.hmac
      const decoded = Buffer.from(token, "base64url").toString("utf8");
      const parts = decoded.split(".");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe(sampleTicket.id);
      expect(parts[1]).toBe(String(window));
      expect(parts[2].length).toBeGreaterThan(10);
    });

    it("should successfully verify token within current window", () => {
      const now = Date.now();
      const { token } = service.generateDynamicToken(sampleTicket.id, 1, now);

      const verification = service.verifyToken(token, sampleTicket, now);
      expect(verification.valid).toBe(true);
      expect(verification.window).toBe(Math.floor(now / 1000 / 30));
    });

    it("should accept token from previous window (1 window clock skew tolerance)", () => {
      const now = 1700000000000;
      const windowSec = 30;
      const prevWindowTime = now - windowSec * 1000;

      const { token } = service.generateDynamicToken(
        sampleTicket.id,
        1,
        prevWindowTime,
      );

      const verification = service.verifyToken(token, sampleTicket, now);
      expect(verification.valid).toBe(true);
    });

    it("should reject token older than 1 window as expired", () => {
      const now = 1700000000000;
      const twoWindowsAgo = now - 65 * 1000; // 65s ago (> 2 windows)

      const { token } = service.generateDynamicToken(
        sampleTicket.id,
        1,
        twoWindowsAgo,
      );

      const verification = service.verifyToken(token, sampleTicket, now);
      expect(verification.valid).toBe(false);
      expect(verification.isExpired).toBe(true);
      expect(verification.reason).toContain("expired");
    });

    it("should reject tampered HMAC signature (timing-safe check)", () => {
      const now = Date.now();
      const { token } = service.generateDynamicToken(sampleTicket.id, 1, now);
      const decoded = Buffer.from(token, "base64url").toString("utf8");
      const [tid, win, hmac] = decoded.split(".");

      // Tamper signature
      const tamperedHmac = hmac.slice(0, -2) + "xx";
      const tamperedToken = Buffer.from(
        `${tid}.${win}.${tamperedHmac}`,
      ).toString("base64url");

      const verification = service.verifyToken(
        tamperedToken,
        sampleTicket,
        now,
      );
      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain("HMAC signature mismatch");
    });

    it("should invalidate previous tokens when seedVersion rotates", () => {
      const now = Date.now();
      const { token } = service.generateDynamicToken(sampleTicket.id, 1, now);

      // Verify token is valid with seedVersion 1
      expect(service.verifyToken(token, sampleTicket, now).valid).toBe(true);

      // Rotate ticket seedVersion to 2
      const rotatedTicket = { ...sampleTicket, seedVersion: 2 };
      const verification = service.verifyToken(token, rotatedTicket, now);
      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain("HMAC signature mismatch");
    });
  });

  describe("getDynamicQr", () => {
    it("should return QR payload when requested by ticket owner", async () => {
      const res = await service.getDynamicQr(sampleTicket.id, {
        id: "user-123",
        role: UserRole.CUSTOMER,
      });

      expect(res.ticketId).toBe(sampleTicket.id);
      expect(res.token).toBeDefined();
      expect(res.windowSeconds).toBe(30);
      expect(res.expiresAt).toBeDefined();
    });

    it("should allow ADMIN to generate dynamic QR for any ticket", async () => {
      const res = await service.getDynamicQr(sampleTicket.id, {
        id: "admin-456",
        role: UserRole.ADMIN,
      });

      expect(res.ticketId).toBe(sampleTicket.id);
      expect(res.token).toBeDefined();
    });

    it("should throw 403 Forbidden when requested by another user", async () => {
      await expect(
        service.getDynamicQr(sampleTicket.id, {
          id: "intruder-789",
          role: UserRole.CUSTOMER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("should throw 400 BadRequest when ticket is already CHECKED_IN", async () => {
      mockTicketRepo.findOne.mockResolvedValueOnce({
        ...sampleTicket,
        status: TicketStatus.CHECKED_IN,
      });

      await expect(
        service.getDynamicQr(sampleTicket.id, {
          id: "user-123",
          role: UserRole.CUSTOMER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw 404 NotFound for non-existent ticket", async () => {
      mockTicketRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.getDynamicQr("00000000-0000-0000-0000-000000000999", {
          id: "user-123",
          role: UserRole.CUSTOMER,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("rotateKey", () => {
    it("should increment seedVersion by 1 and save", async () => {
      const rotated = await service.rotateKey(sampleTicket.id);
      expect(rotated.seedVersion).toBe(2);
      expect(mockTicketRepo.save).toHaveBeenCalled();
    });
  });

  describe("getUserTickets", () => {
    it("should return tickets belonging to user", async () => {
      const tickets = await service.getUserTickets("user-123");
      expect(tickets).toHaveLength(1);
      expect(tickets[0].ownerId).toBe("user-123");
    });
  });
});
