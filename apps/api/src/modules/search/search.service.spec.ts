import { Client } from "@elastic/elasticsearch";
import { Repository } from "typeorm";
import { Event } from "@urticketbuddy/db";
import { SearchService } from "./search.service";
import { SearchCircuitBreaker } from "./search-circuit-breaker";

describe("SearchService", () => {
  const sampleEventId = "11111111-1111-4111-8111-111111111111";
  const sampleVenueId = "22222222-2222-4222-8222-222222222222";

  const mockEsClient = {
    search: jest.fn(),
    indices: {
      existsAlias: jest.fn(),
    },
  };

  const mockQueryBuilder = {
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
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  let now = 1_000;
  let service: SearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    now = 1_000;
    const cb = new SearchCircuitBreaker({
      failureThreshold: 3,
      cooldownMs: 30_000,
      now: () => now,
    });
    service = new SearchService(
      mockEsClient as unknown as Client,
      mockEventRepo as unknown as Repository<Event>,
      cb,
    );
  });

  it("returns elasticsearch backend when Elasticsearch succeeds", async () => {
    mockEsClient.search.mockResolvedValueOnce({
      hits: {
        total: { value: 1, relation: "eq" },
        hits: [
          {
            _source: {
              id: sampleEventId,
              title: "Summer Rock Fest",
              description: "Live rock",
              city: "Lahore",
              category: "music",
              startsAt: "2026-12-10T19:00:00.000Z",
              status: "PUBLISHED",
              venueId: sampleVenueId,
              venueName: "Alhamra",
              location: { lat: 31.55, lon: 74.33 },
              minPrice: 1500,
              maxPrice: 5000,
            },
          },
        ],
      },
    });

    const outcome = await service.searchEvents({
      q: "rock",
      sort: "relevance",
      page: 1,
      pageSize: 20,
    });

    expect(outcome.backend).toBe("elasticsearch");
    expect(outcome.result.total).toBe(1);
    expect(outcome.result.items).toHaveLength(1);
    expect(outcome.result.items[0]?.title).toBe("Summer Rock Fest");
    expect(mockEventRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it("opens circuit breaker after threshold failures and falls back to Postgres without calling ES during cooldown", async () => {
    mockEsClient.search.mockRejectedValue(new Error("ES connection refused"));
    mockQueryBuilder.getManyAndCount.mockResolvedValue([
      [
        {
          id: sampleEventId,
          venueId: sampleVenueId,
          name: "Fallback Concert",
          startTime: new Date("2026-12-15T18:00:00Z"),
          status: "PUBLISHED",
          venue: { id: sampleVenueId, name: "Arena", location: "Lahore" },
        },
      ],
      1,
    ]);

    for (let i = 0; i < 3; i++) {
      const res = await service.searchEvents({
        q: "concert",
        city: "Lahore",
        sort: "relevance",
        page: 1,
        pageSize: 20,
      });
      expect(res.backend).toBe("postgres-fallback");
      expect(res.result.items[0]?.title).toBe("Fallback Concert");
    }

    expect(mockEsClient.search).toHaveBeenCalledTimes(3);
    expect(service.getCircuitBreaker().getState()).toBe("OPEN");

    // 4th call during cooldown must short-circuit ES completely
    const shortCircuited = await service.searchEvents({
      q: "concert",
      sort: "relevance",
      page: 1,
      pageSize: 20,
    });
    expect(shortCircuited.backend).toBe("postgres-fallback");
    expect(mockEsClient.search).toHaveBeenCalledTimes(3);
  });

  it("falls back to Postgres on suggestEvents when ES errors", async () => {
    mockEsClient.search.mockRejectedValueOnce(new Error("ES down"));
    mockQueryBuilder.getMany.mockResolvedValueOnce([
      {
        id: sampleEventId,
        name: "Lahore Jazz Night",
        venue: { location: "Lahore" },
      },
    ]);

    const outcome = await service.suggestEvents({ q: "lah", limit: 8 });
    expect(outcome.backend).toBe("postgres-fallback");
    expect(outcome.result.suggestions).toEqual([
      { id: sampleEventId, title: "Lahore Jazz Night", city: "Lahore" },
    ]);
  });

  it("checks alias existence safely", async () => {
    mockEsClient.indices.existsAlias.mockResolvedValueOnce(true);
    await expect(service.checkAliasExists()).resolves.toBe(true);

    mockEsClient.indices.existsAlias.mockRejectedValueOnce(new Error("down"));
    await expect(service.checkAliasExists()).resolves.toBe(false);
  });
});
