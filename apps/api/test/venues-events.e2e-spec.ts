import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { GlobalHttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import {
  DATA_SOURCE,
  MONGO_CONNECTION,
  VENUE_REPOSITORY,
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  USER_REPOSITORY,
  VENUE_LAYOUT_MODEL,
} from "../src/database/database.tokens";

jest.setTimeout(30000);

describe("Venues & Events API (e2e - Supertest)", () => {
  let app: INestApplication;

  // In-memory relational storage
  const venuesStore = new Map<string, any>();
  const eventsStore = new Map<string, any>();
  let eventSeatsStore: any[] = [];
  const mongoLayoutsStore = new Map<string, any>();

  const mockVenueRepo = {
    create: jest.fn((dto: any) => ({
      id: `venue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...dto,
    })),
    save: jest.fn(async (entity: any) => {
      venuesStore.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where }: any) => {
      return venuesStore.get(where.id) || null;
    }),
  };

  const mockEventRepo = {
    create: jest.fn((dto: any) => ({
      id: `event-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...dto,
    })),
    save: jest.fn(async (entity: any) => {
      eventsStore.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where }: any) => {
      const event = eventsStore.get(where.id);
      if (!event) return null;
      return {
        ...event,
        venue: venuesStore.get(event.venueId) || null,
      };
    }),
  };

  const mockEventSeatRepo = {
    delete: jest.fn(async ({ eventId }: any) => {
      eventSeatsStore = eventSeatsStore.filter((s) => s.eventId !== eventId);
      return { affected: 1 };
    }),
    insert: jest.fn(async (chunk: any[]) => {
      eventSeatsStore.push(...chunk);
      return {};
    }),
    find: jest.fn(async ({ where }: any) => {
      return eventSeatsStore.filter((s) => s.eventId === where.eventId);
    }),
  };

  const MockVenueLayoutModel: any = jest
    .fn()
    .mockImplementation((payload: any) => {
      const mongoId = `mongo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      return {
        _id: mongoId,
        ...payload,
        save: async () => {
          mongoLayoutsStore.set(mongoId, { _id: mongoId, ...payload });
          return { _id: mongoId, ...payload };
        },
      };
    });

  MockVenueLayoutModel.findById = jest.fn((id: string) => ({
    lean: async () => mongoLayoutsStore.get(id) || null,
  }));

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATA_SOURCE)
      .useValue({
        isInitialized: true,
        destroy: jest.fn(),
      })
      .overrideProvider(MONGO_CONNECTION)
      .useValue({
        readyState: 1,
      })
      .overrideProvider(VENUE_REPOSITORY)
      .useValue(mockVenueRepo)
      .overrideProvider(EVENT_REPOSITORY)
      .useValue(mockEventRepo)
      .overrideProvider(EVENT_SEAT_REPOSITORY)
      .useValue(mockEventSeatRepo)
      .overrideProvider(USER_REPOSITORY)
      .useValue({ findOne: jest.fn(), save: jest.fn(), create: jest.fn() })
      .overrideProvider(VENUE_LAYOUT_MODEL)
      .useValue(MockVenueLayoutModel)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    venuesStore.clear();
    eventsStore.clear();
    eventSeatsStore = [];
    mongoLayoutsStore.clear();
  });

  const validLayout = {
    schemaVersion: 1,
    name: "Metropolis Arena Layout",
    dimensions: { width: 1200, height: 900 },
    sections: [
      // 10 rows x 15 columns = 150 seats
      {
        type: "grid",
        id: "SEC-GRID-1",
        name: "Main Floor",
        origin: { x: 50, y: 50 },
        rows: 10,
        columns: 15,
        seatWidth: 20,
        gapX: 5,
        gapY: 5,
        staggerOffset: 0,
        aisleColumns: [],
        aisleWidth: 0,
      },
      // 1 table with 8 seats = 8 seats
      {
        type: "table",
        id: "VIP-TABLE-1",
        name: "VIP Table 1",
        center: { x: 600, y: 600 },
        tableRadius: 50,
        seatCount: 8,
      },
    ],
    seats: [],
  };

  it("POST /api/v1/venues - should return 400 Bad Request when layout schema is invalid", async () => {
    const invalidPayload = {
      name: "Invalid Arena",
      location: "Gotham City",
      layout: {
        schemaVersion: 99, // Schema requires schemaVersion: 1
        name: "Bad Arena Layout",
        sections: [],
      },
    };

    const res = await request(app.getHttpServer())
      .post("/api/v1/venues")
      .send(invalidPayload)
      .expect(400);

    expect(res.body).toBeDefined();
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("POST /api/v1/venues - should successfully persist venue in Postgres and layout in Mongo", async () => {
    const validVenuePayload = {
      name: "Metropolis Arena",
      location: "Metropolis City Center",
      layout: validLayout,
    };

    const res = await request(app.getHttpServer())
      .post("/api/v1/venues")
      .send(validVenuePayload)
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("Metropolis Arena");
    expect(res.body.location).toBe("Metropolis City Center");
    expect(res.body.layoutMongoId).toBeDefined();
    expect(venuesStore.has(res.body.id)).toBe(true);
    expect(mongoLayoutsStore.has(res.body.layoutMongoId)).toBe(true);
  });

  it("GET /api/v1/venues/:id - should return venue joined with layout", async () => {
    // Create venue first
    const createRes = await request(app.getHttpServer())
      .post("/api/v1/venues")
      .send({
        name: "Joined Arena",
        location: "Central City",
        layout: validLayout,
      })
      .expect(201);

    const venueId = createRes.body.id;

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/venues/${venueId}`)
      .expect(200);

    expect(getRes.body.id).toBe(venueId);
    expect(getRes.body.name).toBe("Joined Arena");
    expect(getRes.body.layout).toBeDefined();
    expect(getRes.body.layout.name).toBe("Metropolis Arena Layout");
  });

  it("POST /api/v1/events/:id/generate-seats - calculates and persists exact seat count", async () => {
    // 1. Create Venue with valid layout (150 grid seats + 8 table seats = 158 seats)
    const venueRes = await request(app.getHttpServer())
      .post("/api/v1/venues")
      .send({
        name: "Grand Pavilion",
        location: "Star City",
        layout: validLayout,
      })
      .expect(201);

    const venueId = venueRes.body.id;

    // 2. Create Event linked to Venue
    const eventRes = await request(app.getHttpServer())
      .post("/api/v1/events")
      .send({
        venueId,
        name: "Symphony Orchestra Concert",
        startTime: new Date("2026-10-10T20:00:00Z").toISOString(),
      })
      .expect(201);

    const eventId = eventRes.body.id;

    // 3. Generate seats
    const genRes = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/generate-seats`)
      .expect(200);

    expect(genRes.body).toEqual({
      eventId,
      venueId,
      totalSeatsGenerated: 158, // 150 grid seats + 8 table seats
      status: "COMPLETED",
    });

    // 4. Verify seat records stored
    expect(eventSeatsStore).toHaveLength(158);
    const firstSeat = eventSeatsStore[0];
    expect(firstSeat.eventId).toBe(eventId);
    expect(firstSeat.status).toBe("AVAILABLE");
    expect(firstSeat.x).toBeDefined();
    expect(firstSeat.y).toBeDefined();
  });
});
