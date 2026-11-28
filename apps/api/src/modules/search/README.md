# Search Module (`UTB-11`)

Public Elasticsearch-backed event search and typeahead suggestion API with a circuit breaker and automatic PostgreSQL fallback.

## Endpoints

Both endpoints are marked `@Public()` and validated with Zod schemas from `@urticketbuddy/contracts`. Every response sets the `X-Search-Backend` header (`elasticsearch` or `postgres-fallback`).

| Method | Path                     | Description                                                                                                                                                                                    |
| :----- | :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/v1/search/events`  | Full-text search (`q`), filters (`city`, `category`, `from`, `to`), geo-distance (`lat`, `lng`, `radiusKm`), price/date/relevance sorting (`sort`), pagination (`page`, `pageSize` max `100`). |
| `GET`  | `/api/v1/search/suggest` | Typeahead suggestions on `title` and `city` using the `edge_ngram` analyzer (`q`, `limit` default `8`).                                                                                        |

## Index Mapping & Alias

- **Alias:** `events` (configured via `ELASTICSEARCH_INDEX_ALIAS`, default `events`)
- **Initial index:** `events_v1` managed by template `events_template` (`events_v*`)
- **Analyzers:** `edge_ngram_index` (min_gram 2, max_gram 20) + `edge_ngram_search` (`standard` + `lowercase`)
- **Document fields:**
  - `title`, `description`: `text` with `edge_ngram_index` analyzer / `edge_ngram_search` search analyzer (plus `.keyword` / `.standard` subfields)
  - `city`, `category`, `status`, `venueId`, `venueName`: `keyword`
  - `startsAt`: `date`
  - `location`: `geo_point`
  - `minPrice`, `maxPrice`: `double` (integer minor units)
- Only `PUBLISHED` events are indexed; `DRAFT` and `CANCELLED` events are excluded/deleted.

## Circuit Breaker & Postgres Fallback

- Controlled by `SEARCH_CB_FAILURE_THRESHOLD` (default `3`) and `SEARCH_CB_COOLDOWN_MS` (default `30000`).
- After `N` consecutive Elasticsearch failures, the circuit opens for the cooldown window and queries PostgreSQL (`events` joined with `venues`, filtering `status = 'PUBLISHED'`, `q`, `city`, `from`, `to` where SQL columns exist).
- After cooldown, a single `HALF_OPEN` probe determines whether to close the circuit or re-open it.
- Health check (`GET /api/v1/health`) checks both the Elasticsearch TCP probe and whether the `events` alias exists (`search.eventsAliasExists`).

## Environment Variables

- `ELASTICSEARCH_NODE` (default `http://localhost:9200`)
- `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD`, `ELASTICSEARCH_API_KEY` (optional)
- `ELASTICSEARCH_INDEX_ALIAS` (default `events`)
- `SEARCH_CB_FAILURE_THRESHOLD` (default `3`)
- `SEARCH_CB_COOLDOWN_MS` (default `30000`)

## Reindexing

Run `pnpm search:reindex` from the repository root to build the next versioned index (`events_v2`, `v3`, ...) in batches from PostgreSQL, atomically swap the `events` alias via `updateAliases`, and delete old versioned indices.
