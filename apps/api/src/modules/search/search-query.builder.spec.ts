import {
  buildSearchEventsQuery,
  buildSuggestQuery,
} from "./search-query.builder";

describe("Search Query Builder", () => {
  it("builds full-text search with PUBLISHED filter, city, category, date range, geo distance, and pagination", () => {
    const req = buildSearchEventsQuery({
      q: "rock",
      city: "Lahore",
      category: "music",
      from: "2026-12-01T00:00:00Z",
      to: "2026-12-31T23:59:59Z",
      lat: 31.5204,
      lng: 74.3587,
      radiusKm: 25,
      sort: "price_asc",
      page: 2,
      pageSize: 10,
    });

    expect(req.from).toBe(10);
    expect(req.size).toBe(10);
    expect(req.sort).toEqual([
      { minPrice: { order: "asc" } },
      { startsAt: { order: "asc" } },
    ]);

    const boolQuery = (req.query as { bool: Record<string, unknown> }).bool;
    expect(boolQuery.must).toEqual([
      {
        multi_match: {
          query: "rock",
          fields: [
            "title^3",
            "title.standard^2",
            "description",
            "city.text",
            "venueName",
          ],
          type: "best_fields",
          fuzziness: "AUTO",
        },
      },
    ]);

    expect(boolQuery.filter).toEqual([
      { term: { status: "PUBLISHED" } },
      { term: { city: { value: "Lahore", case_insensitive: true } } },
      { term: { category: { value: "music", case_insensitive: true } } },
      {
        range: {
          startsAt: {
            gte: "2026-12-01T00:00:00.000Z",
            lte: "2026-12-31T23:59:59.000Z",
          },
        },
      },
      {
        geo_distance: {
          distance: "25km",
          location: { lat: 31.5204, lon: 74.3587 },
        },
      },
    ]);
  });

  it("uses match_all when q is omitted and supports all sort modes", () => {
    const dateDesc = buildSearchEventsQuery({
      sort: "date_desc",
      page: 1,
      pageSize: 20,
    });
    expect((dateDesc.query as { bool: { must: unknown[] } }).bool.must).toEqual(
      [{ match_all: {} }],
    );
    expect(dateDesc.sort).toEqual([
      { startsAt: { order: "desc" } },
      { _score: { order: "desc" } },
    ]);

    const priceDesc = buildSearchEventsQuery({
      sort: "price_desc",
      page: 1,
      pageSize: 20,
    });
    expect(priceDesc.sort).toEqual([
      { maxPrice: { order: "desc" } },
      { startsAt: { order: "asc" } },
    ]);
  });

  it("builds suggest query limited to configured size with title and city fields", () => {
    const req = buildSuggestQuery({ q: "lah", limit: 8 });
    expect(req.size).toBe(8);
    expect(req._source).toEqual(["id", "title", "city"]);
    expect(req.query).toEqual({
      bool: {
        must: [
          {
            multi_match: {
              query: "lah",
              fields: ["title^3", "city.text"],
              type: "best_fields",
            },
          },
        ],
        filter: [{ term: { status: "PUBLISHED" } }],
      },
    });
  });
});
