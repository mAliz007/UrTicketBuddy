import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ErrorCode } from "@urticketbuddy/contracts";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { GlobalHttpExceptionFilter } from "../src/common/filters/http-exception.filter";
import {
  AUDIT_LOG_REPOSITORY,
  DATA_SOURCE,
  EVENT_REPOSITORY,
  EVENT_SEAT_REPOSITORY,
  GATE_SCAN_REPOSITORY,
  LEDGER_ENTRY_REPOSITORY,
  MONGO_CONNECTION,
  ORDER_ITEM_REPOSITORY,
  ORDER_REPOSITORY,
  PLATFORM_SETTING_REPOSITORY,
  REDIS_CLIENT,
  REDIS_SCRIPTS_WRAPPER,
  REFRESH_TOKEN_REPOSITORY,
  RESALE_LISTING_REPOSITORY,
  TICKET_REPOSITORY,
  USER_REPOSITORY,
  VENUE_LAYOUT_MODEL,
  VENUE_REPOSITORY,
} from "../src/database/database.tokens";
import { CHECKOUT_REDIS_CLIENT } from "../src/modules/checkout/checkout.tokens";
import { ELASTICSEARCH_CLIENT } from "../src/modules/search/search.tokens";
import { SearchService } from "../src/modules/search/search.service";

jest.setTimeout(30000);

describe("Search API & Fallback (e2e - Supertest)", () => {
  let app: INestApplication;
  let searchService: SearchService;

  const event1Id = "11111111-1111-4111-8111-111111111111";
  const venue1Id = "22222222-2222-4222-8222-222222222222";

  const mockEsClient = {
    search: jest.fn(),
    indices: {
      existsAlias: jest.fn().mockResolvedValue(true),
    },
    close: jest.fn().mockResolvedValue(undefined),
  };

  const mockQb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    getMany: jest.fn(),
  };

  const mockEventRepo = {
    createQueryBuilder: jest.fn(() => mockQb),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATA_SOURCE)
      .useValue({
        isInitialized: true,
        destroy: jest.fn(),
        getRepository: jest.fn(() => ({})),
      })
      .overrideProvider(MONGO_CONNECTION)
      .useValue({ readyState: 1, model: jest.fn() })
      .overrideProvider(USER_REPOSITORY)
      .useValue({})
      .overrideProvider(REFRESH_TOKEN_REPOSITORY)
      .useValue({})
      .overrideProvider(TICKET_REPOSITORY)
      .useValue({})
      .overrideProvider(VENUE_REPOSITORY)
      .useValue({})
      .overrideProvider(EVENT_REPOSITORY)
      .useValue(mockEventRepo)
      .overrideProvider(EVENT_SEAT_REPOSITORY)
      .useValue({})
      .overrideProvider(ORDER_REPOSITORY)
      .useValue({})
      .overrideProvider(ORDER_ITEM_REPOSITORY)
      .useValue({})
      .overrideProvider(GATE_SCAN_REPOSITORY)
      .useValue({})
      .overrideProvider(PLATFORM_SETTING_REPOSITORY)
      .useValue({})
      .overrideProvider(AUDIT_LOG_REPOSITORY)
      .useValue({})
      .overrideProvider(RESALE_LISTING_REPOSITORY)
      .useValue({})
      .overrideProvider(LEDGER_ENTRY_REPOSITORY)
      .useValue({})
      .overrideProvider(VENUE_LAYOUT_MODEL)
      .useValue({})
      .overrideProvider(REDIS_CLIENT)
      .useValue({
        publish: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        defineCommand: jest.fn(),
      })
      .overrideProvider(CHECKOUT_REDIS_CLIENT)
      .useValue({
        publish: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
      })
      .overrideProvider(REDIS_SCRIPTS_WRAPPER)
      .useValue({
        holdSeats: jest.fn(),
        confirmSold: jest.fn(),
        unsellSeats: jest.fn(),
        getCounts: jest.fn(),
      })
      .overrideProvider(ELASTICSEARCH_CLIENT)
      .useValue(mockEsClient)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    app.useGlobalFilters(new GlobalHttpExceptionFilter());
    await app.init();

    searchService = moduleFixture.get<SearchService>(SearchService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    searchService.getCircuitBreaker().reset();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it("GET /api/v1/search/events is @Public(), validates params, and returns elasticsearch results with X-Search-Backend header", async () => {
    mockEsClient.search.mockResolvedValueOnce({
      hits: {
        total: { value: 1, relation: "eq" },
        hits: [
          {
            _source: {
              id: event1Id,
              title: "Symphony Live",
              description: "Classical concert",
              city: "Lahore",
              category: "music",
              startsAt: "2026-12-10T19:00:00.000Z",
              status: "PUBLISHED",
              venueId: venue1Id,
              venueName: "Alhamra",
              location: { lat: 31.55, lon: 74.33 },
              minPrice: 2000,
              maxPrice: 6000,
            },
          },
        ],
      },
    });

    const res = await request(app.getHttpServer())
      .get("/api/v1/search/events?q=symphony&city=Lahore&page=1&pageSize=10")
      .expect(200);

    expect(res.headers["x-search-backend"]).toBe("elasticsearch");
    expect(res.body).toEqual({
      items: [
        expect.objectContaining({
          id: event1Id,
          title: "Symphony Live",
          city: "Lahore",
        }),
      ],
      page: 1,
      pageSize: 10,
      total: 1,
    });
  });

  it("GET /api/v1/search/events rejects invalid query params with 400 VALIDATION_ERROR", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/search/events?pageSize=200")
      .expect(400);
    expect(res.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);

    const partialGeo = await request(app.getHttpServer())
      .get("/api/v1/search/events?lat=31.5&lng=74.3")
      .expect(400);
    expect(partialGeo.body.error.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("GET /api/v1/search/suggest returns short suggestions with X-Search-Backend header", async () => {
    mockEsClient.search.mockResolvedValueOnce({
      hits: {
        hits: [
          {
            _source: {
              id: event1Id,
              title: "Symphony Live",
              city: "Lahore",
            },
          },
        ],
      },
    });

    const res = await request(app.getHttpServer())
      .get("/api/v1/search/suggest?q=sym")
      .expect(200);

    expect(res.headers["x-search-backend"]).toBe("elasticsearch");
    expect(res.body.suggestions).toEqual([
      { id: event1Id, title: "Symphony Live", city: "Lahore" },
    ]);
  });

  it("falls back to Postgres and sets X-Search-Backend: postgres-fallback when Elasticsearch fails and circuit opens", async () => {
    mockEsClient.search.mockRejectedValue(new Error("ES unreachable"));
    mockQb.getManyAndCount.mockResolvedValue([
      [
        {
          id: event1Id,
          venueId: venue1Id,
          name: "Postgres Event",
          startTime: new Date("2026-12-20T18:00:00Z"),
          status: "PUBLISHED",
          venue: {
            id: venue1Id,
            name: "National Stadium",
            location: "Karachi",
          },
        },
      ],
      1,
    ]);

    for (let i = 0; i < 4; i++) {
      const res = await request(app.getHttpServer())
        .get("/api/v1/search/events?q=postgres&city=Karachi")
        .expect(200);

      expect(res.headers["x-search-backend"]).toBe("postgres-fallback");
      expect(res.body.items[0].title).toBe("Postgres Event");
      expect(res.body.items[0].city).toBe("Karachi");
    }

    // Threshold is 3, so 4th call was served without hitting ES
    expect(mockEsClient.search).toHaveBeenCalledTimes(3);
  });

  it("GET /api/v1/health reports search.eventsAliasExists status", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200);

    expect(res.body.status).toBe("ok");
    expect(res.body.dependencies).toHaveProperty("elasticsearch");
    expect(res.body.search).toBeDefined();
    expect(res.body.search.alias).toBe("events");
    expect(typeof res.body.search.eventsAliasExists).toBe("boolean");
  });
});
