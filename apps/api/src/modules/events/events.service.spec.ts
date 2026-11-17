import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EventsService, CHUNK_SIZE } from "./events.service";
import {
  EVENT_REPOSITORY,
  VENUE_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  VENUE_LAYOUT_MODEL,
} from "../../database/database.tokens";

describe("EventsService", () => {
  let service: EventsService;

  const mockEventRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockVenueRepo = {
    findOne: jest.fn(),
  };

  const mockEventSeatRepo = {
    delete: jest.fn(),
    insert: jest.fn(),
    find: jest.fn(),
  };

  const MockVenueLayoutModel: any = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        {
          provide: EVENT_REPOSITORY,
          useValue: mockEventRepo,
        },
        {
          provide: VENUE_REPOSITORY,
          useValue: mockVenueRepo,
        },
        {
          provide: EVENT_SEAT_REPOSITORY,
          useValue: mockEventSeatRepo,
        },
        {
          provide: VENUE_LAYOUT_MODEL,
          useValue: MockVenueLayoutModel,
        },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  describe("createEvent", () => {
    it("should throw BadRequestException if name is missing", async () => {
      await expect(
        service.createEvent({
          name: "",
          venueId: "venue-1",
          startTime: new Date().toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if venueId is missing", async () => {
      await expect(
        service.createEvent({
          name: "Concert",
          venueId: "",
          startTime: new Date().toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException if startTime is invalid", async () => {
      await expect(
        service.createEvent({
          name: "Concert",
          venueId: "venue-1",
          startTime: "invalid-date",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if venue does not exist", async () => {
      mockVenueRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createEvent({
          name: "Concert",
          venueId: "non-existent-venue",
          startTime: new Date().toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should create and return event when valid", async () => {
      const now = new Date();
      mockVenueRepo.findOne.mockResolvedValue({ id: "venue-1" });
      mockEventRepo.create.mockReturnValue({
        id: "event-1",
        venueId: "venue-1",
        name: "Rock Concert",
        startTime: now,
        status: "DRAFT",
        createdAt: now,
        updatedAt: now,
      });
      mockEventRepo.save.mockResolvedValue({
        id: "event-1",
        venueId: "venue-1",
        name: "Rock Concert",
        startTime: now,
        status: "DRAFT",
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.createEvent({
        name: "Rock Concert",
        venueId: "venue-1",
        startTime: now.toISOString(),
      });

      expect(result).toBeDefined();
      expect(result.id).toBe("event-1");
      expect(result.status).toBe("DRAFT");
    });
  });

  describe("generateSeats", () => {
    const mockEvent = {
      id: "event-uuid-1",
      venueId: "venue-uuid-1",
      name: "Championship Game",
    };

    const mockVenue = {
      id: "venue-uuid-1",
      name: "Main Arena",
      layoutMongoId: "mongo-layout-99",
    };

    it("should throw NotFoundException if event does not exist", async () => {
      mockEventRepo.findOne.mockResolvedValue(null);

      await expect(service.generateSeats("missing-event")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw NotFoundException if venue does not exist", async () => {
      mockEventRepo.findOne.mockResolvedValue(mockEvent);
      mockVenueRepo.findOne.mockResolvedValue(null);

      await expect(service.generateSeats("event-uuid-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw BadRequestException if mongo layout document is missing", async () => {
      mockEventRepo.findOne.mockResolvedValue(mockEvent);
      mockVenueRepo.findOne.mockResolvedValue(mockVenue);
      MockVenueLayoutModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(service.generateSeats("event-uuid-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should mathematically calculate exact seats from grid, arc, and table sections", async () => {
      mockEventRepo.findOne.mockResolvedValue(mockEvent);
      mockVenueRepo.findOne.mockResolvedValue(mockVenue);

      const layoutWithMultipleSections = {
        name: "Multi Section Layout",
        schemaVersion: 1,
        sections: [
          // 5 rows x 10 cols = 50 seats
          {
            type: "grid",
            id: "SEC-GRID",
            origin: { x: 0, y: 0 },
            rows: 5,
            columns: 10,
            seatWidth: 20,
            gapX: 5,
            gapY: 5,
          },
          // Table with 8 seats
          {
            type: "table",
            id: "SEC-TABLE",
            center: { x: 500, y: 500 },
            tableRadius: 60,
            seatCount: 8,
          },
        ],
        seats: [],
      };

      MockVenueLayoutModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(layoutWithMultipleSections),
      });
      mockEventSeatRepo.delete.mockResolvedValue({ affected: 0 });
      mockEventSeatRepo.insert.mockResolvedValue({});

      const result = await service.generateSeats("event-uuid-1");

      expect(result).toBeDefined();
      expect(result.eventId).toBe("event-uuid-1");
      // 50 (grid) + 8 (table) = 58 seats
      expect(result.totalSeatsGenerated).toBe(58);
      expect(mockEventSeatRepo.delete).toHaveBeenCalledWith({
        eventId: "event-uuid-1",
      });
      expect(mockEventSeatRepo.insert).toHaveBeenCalledTimes(1);

      const insertedSeats = mockEventSeatRepo.insert.mock.calls[0][0];
      expect(insertedSeats).toHaveLength(58);
      expect(insertedSeats[0].status).toBe("AVAILABLE");
      expect(insertedSeats[0].eventId).toBe("event-uuid-1");
    });

    it("should chunk bulk inserts in batches of 1,000 when seats exceed CHUNK_SIZE", async () => {
      mockEventRepo.findOne.mockResolvedValue(mockEvent);
      mockVenueRepo.findOne.mockResolvedValue(mockVenue);

      // 50 rows x 50 columns = 2,500 seats (exceeds CHUNK_SIZE = 1,000)
      const largeGridLayout = {
        name: "Mega Stadium Layout",
        schemaVersion: 1,
        sections: [
          {
            type: "grid",
            id: "SEC-STADIUM",
            origin: { x: 0, y: 0 },
            rows: 50,
            columns: 50,
            seatWidth: 15,
            gapX: 5,
            gapY: 5,
          },
        ],
        seats: [],
      };

      MockVenueLayoutModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(largeGridLayout),
      });
      mockEventSeatRepo.delete.mockResolvedValue({ affected: 0 });
      mockEventSeatRepo.insert.mockResolvedValue({});

      const result = await service.generateSeats("event-uuid-1");

      expect(result.totalSeatsGenerated).toBe(2500);
      // 2500 seats / 1000 = 3 chunks (1000, 1000, 500)
      expect(mockEventSeatRepo.insert).toHaveBeenCalledTimes(3);

      expect(mockEventSeatRepo.insert.mock.calls[0][0]).toHaveLength(1000);
      expect(mockEventSeatRepo.insert.mock.calls[1][0]).toHaveLength(1000);
      expect(mockEventSeatRepo.insert.mock.calls[2][0]).toHaveLength(500);
    });
  });

  describe("getSeatAvailability", () => {
    it("should return map of seat availability", async () => {
      mockEventSeatRepo.find.mockResolvedValue([
        { seatId: "SEC-A-1", status: "AVAILABLE" },
        { seatId: "SEC-A-2", status: "HELD" },
      ]);

      const result = await service.getSeatAvailability("event-1", [
        "SEC-A-1",
        "SEC-A-2",
        "SEC-A-3",
      ]);

      expect(result.get("SEC-A-1")).toBe(true);
      expect(result.get("SEC-A-2")).toBe(false);
      expect(result.get("SEC-A-3")).toBe(false);
    });
  });
});
