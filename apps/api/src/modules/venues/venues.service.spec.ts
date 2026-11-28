import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { UserRole } from "@urticketbuddy/contracts";
import { VenuesService } from "./venues.service";
import {
  VENUE_REPOSITORY,
  VENUE_LAYOUT_MODEL,
} from "../../database/database.tokens";

describe("VenuesService", () => {
  let service: VenuesService;

  const mockVenueRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockSavedLayoutDoc = {
    _id: "mongo-layout-123",
    save: jest.fn().mockResolvedValue({ _id: "mongo-layout-123" }),
  };

  const MockVenueLayoutModel = Object.assign(
    jest.fn().mockImplementation(() => mockSavedLayoutDoc),
    { findById: jest.fn() },
  );

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VenuesService,
        {
          provide: VENUE_REPOSITORY,
          useValue: mockVenueRepo,
        },
        {
          provide: VENUE_LAYOUT_MODEL,
          useValue: MockVenueLayoutModel,
        },
      ],
    }).compile();

    service = module.get<VenuesService>(VenuesService);
  });

  const validLayout = {
    schemaVersion: 1,
    name: "Standard Arena",
    dimensions: { width: 1000, height: 800 },
    sections: [
      {
        type: "grid",
        id: "sec-a",
        name: "Section A",
        origin: { x: 50, y: 50 },
        rows: 5,
        columns: 10,
        seatWidth: 30,
        gapX: 10,
        gapY: 10,
        staggerOffset: 0,
        aisleColumns: [],
        aisleWidth: 0,
      },
    ],
    seats: [],
  };

  it("should throw BadRequestException when venue name is missing", async () => {
    await expect(
      service.createVenue({
        name: "",
        location: "New York",
        layout: validLayout,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should throw UnprocessableEntityException (422) when layout is invalid", async () => {
    const invalidLayout = {
      schemaVersion: 2, // invalid schemaVersion (must be 1)
      name: "Bad Arena",
    };

    await expect(
      service.createVenue({
        name: "Arena",
        location: "New York",
        layout: invalidLayout,
      }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("should update venue layout with Mongo versioning and enforce tenant ownership and structure lock", async () => {
    mockVenueRepo.findOne.mockResolvedValue({
      id: "uuid-123",
      name: "Madison Square Garden",
      location: "New York",
      organizerId: "org-1",
      layoutMongoId: "mongo-layout-v1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockVenueRepo.save.mockImplementation(async (v) => v);
    MockVenueLayoutModel.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue({ ...validLayout, version: 1 }),
    });

    // Cross-tenant organizer rejected with 403
    await expect(
      service.updateVenueLayout(
        "uuid-123",
        { layout: validLayout },
        {
          id: "org-2",
          role: UserRole.ORGANIZER,
          organizerTenantId: "org-2",
        },
      ),
    ).rejects.toThrow(ForbiddenException);

    // Owner organizer succeeds and bumps version to 2
    const updated = await service.updateVenueLayout(
      "uuid-123",
      { layout: validLayout },
      {
        id: "org-1",
        role: UserRole.ORGANIZER,
        organizerTenantId: "org-1",
      },
    );
    expect(updated.version).toBe(2);
    expect(updated.previousLayoutId).toBe("mongo-layout-v1");
  });

  it("should create venue and save layout to Mongo and Postgres", async () => {
    mockVenueRepo.create.mockReturnValue({
      id: "uuid-123",
      name: "Madison Square Garden",
      location: "New York",
      layoutMongoId: "mongo-layout-123",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockVenueRepo.save.mockResolvedValue({
      id: "uuid-123",
      name: "Madison Square Garden",
      location: "New York",
      layoutMongoId: "mongo-layout-123",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createVenue({
      name: "Madison Square Garden",
      location: "New York",
      layout: validLayout,
    });

    expect(result).toBeDefined();
    expect(result.id).toBe("uuid-123");
    expect(result.layoutMongoId).toBe("mongo-layout-123");
    expect(mockVenueRepo.save).toHaveBeenCalled();
  });

  it("should get venue by ID and join Mongo layout", async () => {
    mockVenueRepo.findOne.mockResolvedValue({
      id: "uuid-123",
      name: "Madison Square Garden",
      location: "New York",
      layoutMongoId: "mongo-layout-123",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    MockVenueLayoutModel.findById.mockReturnValue({
      lean: jest.fn().mockResolvedValue(validLayout),
    });

    const result = await service.getVenueById("uuid-123");

    expect(result).toBeDefined();
    expect(result.id).toBe("uuid-123");
    expect(result.layout).toEqual(validLayout);
  });

  it("should throw NotFoundException if venue not found in Postgres", async () => {
    mockVenueRepo.findOne.mockResolvedValue(null);

    await expect(service.getVenueById("non-existent-id")).rejects.toThrow(
      NotFoundException,
    );
  });
});
