import type { estypes } from "@elastic/elasticsearch";
import {
  SearchEventsQuery,
  SearchSuggestQuery,
} from "@urticketbuddy/contracts";

export function buildSearchEventsQuery(
  query: SearchEventsQuery,
): estypes.SearchRequest {
  const must: estypes.QueryDslQueryContainer[] = [];
  const filter: estypes.QueryDslQueryContainer[] = [
    { term: { status: "PUBLISHED" } },
  ];

  if (query.q) {
    must.push({
      multi_match: {
        query: query.q,
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
    });
  }

  if (query.city) {
    filter.push({
      term: {
        city: {
          value: query.city,
          case_insensitive: true,
        },
      },
    });
  }

  if (query.category) {
    filter.push({
      term: {
        category: {
          value: query.category,
          case_insensitive: true,
        },
      },
    });
  }

  if (query.from || query.to) {
    const range: estypes.QueryDslDateRangeQuery = {};
    if (query.from) {
      range.gte = new Date(query.from).toISOString();
    }
    if (query.to) {
      range.lte = new Date(query.to).toISOString();
    }
    filter.push({
      range: {
        startsAt: range,
      },
    });
  }

  if (
    query.lat !== undefined &&
    query.lng !== undefined &&
    query.radiusKm !== undefined
  ) {
    filter.push({
      geo_distance: {
        distance: `${query.radiusKm}km`,
        location: {
          lat: query.lat,
          lon: query.lng,
        },
      },
    });
  }

  const sort: estypes.Sort = [];
  switch (query.sort) {
    case "date_asc":
      sort.push({ startsAt: { order: "asc" } }, { _score: { order: "desc" } });
      break;
    case "date_desc":
      sort.push({ startsAt: { order: "desc" } }, { _score: { order: "desc" } });
      break;
    case "price_asc":
      sort.push({ minPrice: { order: "asc" } }, { startsAt: { order: "asc" } });
      break;
    case "price_desc":
      sort.push(
        { maxPrice: { order: "desc" } },
        { startsAt: { order: "asc" } },
      );
      break;
    case "relevance":
    default:
      if (query.q) {
        sort.push(
          { _score: { order: "desc" } },
          { startsAt: { order: "asc" } },
        );
      } else {
        sort.push({ startsAt: { order: "asc" } });
      }
      break;
  }

  const from = (query.page - 1) * query.pageSize;

  return {
    from,
    size: query.pageSize,
    track_total_hits: true,
    query: {
      bool: {
        must: must.length > 0 ? must : [{ match_all: {} }],
        filter,
      },
    },
    sort,
  };
}

export function buildSuggestQuery(
  query: SearchSuggestQuery,
): estypes.SearchRequest {
  return {
    size: query.limit,
    _source: ["id", "title", "city"],
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query: query.q,
              fields: ["title^3", "city.text"],
              type: "best_fields",
            },
          },
        ],
        filter: [{ term: { status: "PUBLISHED" } }],
      },
    },
    sort: [{ _score: { order: "desc" } }, { startsAt: { order: "asc" } }],
  };
}
