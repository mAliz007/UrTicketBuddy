import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
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

  it("should throw BadRequestException when layout is invalid", async () => {
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
    ).rejects.toThrow(BadRequestException);
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
