import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  ErrorCode,
  LedgerEntryKind,
  ResaleListingStatus,
  TicketStatus,
} from "@urticketbuddy/contracts";
import { LedgerEntry, ResaleListing, Ticket } from "@urticketbuddy/db";
import { PLATFORM_SETTINGS_PORT } from "../../common/ports";
import { DefaultPlatformSettingsProvider } from "../../common/ports/default-platform-settings.provider";
import {
  DATA_SOURCE,
  REDIS_CLIENT,
  RESALE_LISTING_REPOSITORY,
  TICKET_REPOSITORY,
} from "../../database/database.tokens";
import { MockPaymentService } from "../orders/payment/mock-payment.service";
import { ResaleService } from "./resale.service";

describe("ResaleService (Unit)", () => {
  let service: ResaleService;
  let mockTicketRepo: { findOne: jest.Mock };
  let mockListingRepo: {
    findOne: jest.Mock;
    findAndCount: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let mockRedis: { set: jest.Mock; eval: jest.Mock };
  let mockManager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let mockDataSource: { transaction: jest.Mock };

  const sellerId = "11111111-1111-4111-8111-111111111111";
  const buyerId = "22222222-2222-4222-8222-222222222222";
  const ticketId = "33333333-3333-4333-8333-333333333333";
  const eventId = "44444444-4444-4444-8444-444444444444";
  const listingId = "55555555-5555-4555-8555-555555555555";

  const futureEvent = {
    id: eventId,
    startTime: new Date(Date.now() + 86_400_000),
  };

  beforeEach(async () => {
    mockTicketRepo = {
      findOne: jest.fn(),
    };

    mockListingRepo = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn((data: Partial<ResaleListing>) => ({
        id: listingId,
        ...data,
      })),
      save: jest.fn(async (entity: ResaleListing) => entity),
    };

    mockRedis = {
      set: jest.fn().mockResolvedValue("OK"),
      eval: jest.fn().mockResolvedValue(1),
    };

    mockManager = {
      findOne: jest.fn(),
      create: jest.fn((_Entity: unknown, data: unknown) => data),
      save: jest.fn(async (_Entity: unknown, data: unknown) => data),
    };

    mockDataSource = {
      transaction: jest.fn(
        async (cb: (manager: typeof mockManager) => Promise<unknown>) =>
          cb(mockManager),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ResaleService,
        MockPaymentService,
        {
          provide: DATA_SOURCE,
          useValue: mockDataSource,
        },
        {
          provide: RESALE_LISTING_REPOSITORY,
          useValue: mockListingRepo,
        },
        {
          provide: TICKET_REPOSITORY,
          useValue: mockTicketRepo,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: PLATFORM_SETTINGS_PORT,
          useClass: DefaultPlatformSettingsProvider,
        },
      ],
    }).compile();

    service = moduleRef.get(ResaleService);
  });

  it("creates listing at exact 110% cap and rejects 1 minor unit above cap", async () => {
    mockTicketRepo.findOne.mockResolvedValue({
      id: ticketId,
      eventId,
      ownerId: sellerId,
      status: TicketStatus.ISSUED,
      faceValueMinor: 1000,
      seedVersion: 1,
      event: futureEvent,
    });
    mockListingRepo.findOne.mockResolvedValue(null);

    const created = await service.createListing(sellerId, {
      ticketId,
      askingPriceMinor: 1100,
    });
    expect(created.askingPriceMinor).toBe(1100);
    expect(created.status).toBe(ResaleListingStatus.ACTIVE);

    await expect(
      service.createListing(sellerId, {
        ticketId,
        askingPriceMinor: 1101,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects checked-in tickets with ConflictException", async () => {
    mockTicketRepo.findOne.mockResolvedValue({
      id: ticketId,
      eventId,
      ownerId: sellerId,
      status: TicketStatus.CHECKED_IN,
      faceValueMinor: 1000,
      seedVersion: 1,
      event: futureEvent,
    });

    await expect(
      service.createListing(sellerId, {
        ticketId,
        askingPriceMinor: 1000,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("rejects non-owner listing creation with ForbiddenException", async () => {
    mockTicketRepo.findOne.mockResolvedValue({
      id: ticketId,
      eventId,
      ownerId: "someone-else",
      status: TicketStatus.ISSUED,
      faceValueMinor: 1000,
      seedVersion: 1,
      event: futureEvent,
    });

    await expect(
      service.createListing(sellerId, {
        ticketId,
        askingPriceMinor: 1000,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows seller to lower price or withdraw, and rejects raising price", async () => {
    const activeListing = {
      id: listingId,
      ticketId,
      eventId,
      sellerId,
      askingPriceMinor: 1050,
      status: ResaleListingStatus.ACTIVE,
      ticket: {
        id: ticketId,
        faceValueMinor: 1000,
      },
    };
    mockListingRepo.findOne.mockResolvedValue(activeListing);

    await expect(
      service.updateListing(listingId, sellerId, { askingPriceMinor: 1080 }),
    ).rejects.toThrow(BadRequestException);

    const lowered = await service.updateListing(listingId, sellerId, {
      askingPriceMinor: 900,
    });
    expect(lowered.askingPriceMinor).toBe(900);

    const withdrawn = await service.updateListing(listingId, sellerId, {
      status: ResaleListingStatus.WITHDRAWN,
    });
    expect(withdrawn.status).toBe(ResaleListingStatus.WITHDRAWN);
  });

  it("splits commission (10%) and seller payout summing exactly to askingPriceMinor, transfers ownership, and increments seedVersion", async () => {
    const askingPriceMinor = 1055; // 10% floor = 105, payout = 950, sum = 1055
    const listing = {
      id: listingId,
      ticketId,
      eventId,
      sellerId,
      askingPriceMinor,
      status: ResaleListingStatus.ACTIVE,
    };
    const ticket = {
      id: ticketId,
      eventId,
      ownerId: sellerId,
      status: TicketStatus.ISSUED,
      seedVersion: 1,
      faceValueMinor: 1000,
    };

    mockListingRepo.findOne.mockResolvedValue({ ...listing });
    mockManager.findOne
      .mockResolvedValueOnce({ ...listing })
      .mockResolvedValueOnce({ ...ticket });

    const result = await service.purchaseListing(
      listingId,
      buyerId,
      { paymentMethodToken: "tok_visa" },
      "idem-key-1",
    );

    expect(result.commissionMinor).toBe(105);
    expect(result.sellerPayoutMinor).toBe(950);
    expect(result.commissionMinor + result.sellerPayoutMinor).toBe(
      askingPriceMinor,
    );
    expect(result.buyerId).toBe(buyerId);
    expect(result.seedVersion).toBe(2);
    expect(result.status).toBe(ResaleListingStatus.SOLD);

    // Verify ledger entries saved
    expect(mockManager.save).toHaveBeenCalledWith(LedgerEntry, [
      expect.objectContaining({
        listingId,
        amountMinor: 105,
        kind: LedgerEntryKind.PLATFORM_COMMISSION,
      }),
      expect.objectContaining({
        listingId,
        amountMinor: 950,
        kind: LedgerEntryKind.SELLER_PAYOUT,
      }),
    ]);

    // Verify ticket transferred & seedVersion incremented
    expect(mockManager.save).toHaveBeenCalledWith(
      Ticket,
      expect.objectContaining({
        id: ticketId,
        ownerId: buyerId,
        seedVersion: 2,
      }),
    );

    // Verify Redis lock released
    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
  });

  it("releases Redis lock when payment fails", async () => {
    mockListingRepo.findOne.mockResolvedValue({
      id: listingId,
      ticketId,
      eventId,
      sellerId,
      askingPriceMinor: 1000,
      status: ResaleListingStatus.ACTIVE,
    });

    await expect(
      service.purchaseListing(
        listingId,
        buyerId,
        { paymentMethodToken: "tok_fail" },
        "idem-key-fail",
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockRedis.eval).toHaveBeenCalledTimes(1);
  });

  it("rejects purchase when Idempotency-Key is missing or Redis lock is held", async () => {
    await expect(
      service.purchaseListing(listingId, buyerId, {}, ""),
    ).rejects.toThrow(BadRequestException);

    mockRedis.set.mockResolvedValueOnce(null);
    await expect(
      service.purchaseListing(listingId, buyerId, {}, "idem-key-2"),
    ).rejects.toThrow(ConflictException);
    expect(ErrorCode.RESALE_PRICE_CAP_EXCEEDED).toBe(
      "RESALE_PRICE_CAP_EXCEEDED",
    );
  });
});
