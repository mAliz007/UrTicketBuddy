import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { JwtService } from "@nestjs/jwt";
import { loadEnv } from "@urticketbuddy/config";
import { ErrorCode, UserRole } from "@urticketbuddy/contracts";
import { AppModule } from "../src/app.module";
import { GlobalHttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import {
  DATA_SOURCE,
  MONGO_CONNECTION,
  VENUE_REPOSITORY,
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  USER_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  VENUE_LAYOUT_MODEL,
} from "../src/database/database.tokens";

jest.setTimeout(30000);

describe("Venues & Events API (e2e - Supertest)", () => {
  let app: INestApplication;
  let organizerToken: string;
  let organizer2Token: string;
  let adminToken: string;

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
    find: jest.fn(async (opts?: any) => {
      const all = Array.from(eventsStore.values()).map((ev) => ({
        ...ev,
        venue: venuesStore.get(ev.venueId) || null,
      }));
      if (opts?.where?.venueId) {
        return all.filter((e) => e.venueId === opts.where.venueId);
      }
      return all;
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
        getRepository: jest.fn(() => ({
          create: jest.fn((d: any) => d),
          save: jest.fn(async (e: any) => e),
          findOne: jest.fn(),
          find: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        })),
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
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue({
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      })
      .overrideProvider(VENUE_LAYOUT_MODEL)
      .useValue(MockVenueLayoutModel)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();

    const env = loadEnv();
    const jwtService = new JwtService({ secret: env.JWT_SECRET });
    organizerToken = jwtService.sign({
      sub: "10000000-0000-4000-a000-000000000001",
      id: "10000000-0000-4000-a000-000000000001",
      email: "organizer@example.com",
      role: UserRole.ORGANIZER,
      organizerTenantId: "10000000-0000-4000-a000-000000000001",
    });
    organizer2Token = jwtService.sign({
      sub: "20000000-0000-4000-a000-000000000002",
      id: "20000000-0000-4000-a000-000000000002",
      email: "organizer2@example.com",
      role: UserRole.ORGANIZER,
      organizerTenantId: "20000000-0000-4000-a000-000000000002",
    });
    adminToken = jwtService.sign({
      sub: "a0000000-0000-4000-a000-000000000001",
      id: "a0000000-0000-4000-a000-000000000001",
      email: "admin@example.com",
      role: UserRole.ADMIN,
    });
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

  it("POST /api/v1/venues - should return 422 Unprocessable Entity when layout schema is invalid", async () => {
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
      .set("Authorization", `Bearer ${organizerToken}`)
      .send(invalidPayload)
      .expect(422);

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
      .set("Authorization", `Bearer ${organizerToken}`)
      .send(validVenuePayload)
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.organizerId).toBe("10000000-0000-4000-a000-000000000001");
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
      .set("Authorization", `Bearer ${organizerToken}`)
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
      .set("Authorization", `Bearer ${organizerToken}`)
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
      .set("Authorization", `Bearer ${organizerToken}`)
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
      .set("Authorization", `Bearer ${organizerToken}`)
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

  it("enforces tenant isolation across venues and events (403 for other organizer, allowed for ADMIN)", async () => {
    const venueRes = await request(app.getHttpServer())
      .post("/api/v1/venues")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({
        name: "Org 1 Arena",
        location: "City A",
        layout: validLayout,
      })
      .expect(201);
    const venueId = venueRes.body.id;

    // Organizer 2 cannot spoof Organizer 1's tenant on POST /venues
    const spoofRes = await request(app.getHttpServer())
      .post("/api/v1/venues")
      .set("Authorization", `Bearer ${organizer2Token}`)
      .send({
        name: "Spoofed Arena",
        location: "City B",
        organizerId: "10000000-0000-4000-a000-000000000001",
        layout: validLayout,
      })
      .expect(403);
    expect(spoofRes.body.error.code).toBe(ErrorCode.FORBIDDEN);

    // Organizer 2 cannot create an event on Organizer 1's venue
    await request(app.getHttpServer())
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${organizer2Token}`)
      .send({
        venueId,
        name: "Unauthorized Event",
        startTime: new Date("2026-10-10T20:00:00Z").toISOString(),
      })
      .expect(403);

    // Organizer 1 creates event on their own venue
    const eventRes = await request(app.getHttpServer())
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({
        venueId,
        name: "Authorized Event",
        startTime: new Date("2026-10-10T20:00:00Z").toISOString(),
      })
      .expect(201);
    const eventId = eventRes.body.id;

    // Organizer 2 cannot generate seats on Organizer 1's event
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/generate-seats`)
      .set("Authorization", `Bearer ${organizer2Token}`)
      .expect(403);

    // ADMIN can bypass and act on any organizer's venue/event
    await request(app.getHttpServer())
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        venueId,
        name: "Admin Event",
        startTime: new Date("2026-10-11T20:00:00Z").toISOString(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/generate-seats`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });

  it("F-4: PUT /api/v1/organizer/venues/:id/layout versions Mongo layout, GET/PATCH /events filters & paginates, publish locks structure (409 STRUCTURE_LOCKED), and enforces tenant ownership (403)", async () => {
    const env = loadEnv();
    const jwtService = new JwtService({ secret: env.JWT_SECRET });
    const otherOrganizerToken = jwtService.sign({
      sub: "20000000-0000-4000-a000-000000000002",
      id: "20000000-0000-4000-a000-000000000002",
      email: "other-org@example.com",
      role: UserRole.ORGANIZER,
      organizerTenantId: "20000000-0000-4000-a000-000000000002",
    });

    // 1. Create Venue (version 1)
    const venueRes = await request(app.getHttpServer())
      .post("/api/v1/venues")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({
        name: "Versioned Arena",
        location: "Lahore",
        layout: validLayout,
      })
      .expect(201);

    const venueId = venueRes.body.id;
    expect(venueRes.body.version).toBe(1);

    // 2. PUT /api/v1/organizer/venues/:id/layout updates layout to version 2
    const updateLayoutRes = await request(app.getHttpServer())
      .put(`/api/v1/organizer/venues/${venueId}/layout`)
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({
        layout: {
          ...validLayout,
          name: "Versioned Arena Layout v2",
        },
      })
      .expect(200);

    expect(updateLayoutRes.body.version).toBe(2);
    expect(updateLayoutRes.body.previousLayoutId).toBe(
      venueRes.body.layoutMongoId,
    );

    // 3. Cross-tenant organizer rejected with 403
    await request(app.getHttpServer())
      .put(`/api/v1/organizer/venues/${venueId}/layout`)
      .set("Authorization", `Bearer ${otherOrganizerToken}`)
      .send({ layout: validLayout })
      .expect(403);

    // 4. Create event with ticketTiers
    const eventRes = await request(app.getHttpServer())
      .post("/api/v1/events")
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({
        venueId,
        name: "Sufi Night Live",
        startTime: new Date("2026-12-01T18:00:00Z").toISOString(),
        ticketTiers: [
          { name: "VIP", priceMinor: 500000, currency: "PKR", capacity: 50 },
          { name: "General", priceMinor: 150000, currency: "PKR" },
        ],
      })
      .expect(201);

    const eventId = eventRes.body.id;
    expect(eventRes.body.ticketTiers).toHaveLength(2);

    // 5. GET /api/v1/events with search filter & pagination
    const listRes = await request(app.getHttpServer())
      .get("/api/v1/events?search=Sufi&page=1&pageSize=10")
      .expect(200);

    expect(listRes.body.total).toBe(1);
    expect(listRes.body.items[0].name).toBe("Sufi Night Live");

    // 6. PATCH /api/v1/events/:id by non-owner organizer -> 403
    await request(app.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set("Authorization", `Bearer ${otherOrganizerToken}`)
      .send({ name: "Hijacked Event" })
      .expect(403);

    // 7. PATCH /api/v1/events/:id by owner -> 200
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/events/${eventId}`)
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({ name: "Sufi Night Grand Finale" })
      .expect(200);
    expect(patchRes.body.name).toBe("Sufi Night Grand Finale");

    // 8. Real publish step (POST /api/v1/events/:id/publish) locks structure
    const pubRes = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${organizerToken}`)
      .expect(200);
    expect(pubRes.body.status).toBe("PUBLISHED");
    expect(pubRes.body.structureLocked).toBe(true);

    // 9. Attempting to re-publish, regenerate seats, or mutate venue layout after publish -> 409 STRUCTURE_LOCKED
    const repubRes = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/publish`)
      .set("Authorization", `Bearer ${organizerToken}`)
      .expect(409);
    expect(repubRes.body.error.code).toBe("STRUCTURE_LOCKED");

    const lockedLayoutRes = await request(app.getHttpServer())
      .put(`/api/v1/organizer/venues/${venueId}/layout`)
      .set("Authorization", `Bearer ${organizerToken}`)
      .send({ layout: validLayout })
      .expect(409);
    expect(lockedLayoutRes.body.error.code).toBe("STRUCTURE_LOCKED");
  });
});
