# @urticketbuddy/worker

Background processing engine powered by NestJS, `@nestjs/schedule`, BullMQ, and `@urticketbuddy/redis-scripts`.

## Tech Stack

- NestJS 11
- `@nestjs/schedule` (Cron scheduler)
- `@urticketbuddy/redis-scripts` (`expire_due.lua` wrapper)
- `ioredis`
- `bullmq`
- TypeORM (`@urticketbuddy/db`, optional PostgreSQL sync)

## Port & Endpoints

- Port: `3002` (Health check endpoint only, configured via `WORKER_PORT`)
- Health check: `GET /api/v1/health` (reports Redis status)

## Hold Expiry & Auto-Release Engine (`ExpiryModule`)

`ExpiryService` (`apps/worker/src/modules/expiry/expiry.service.ts`) runs a scheduled cron job every **5 seconds** (`@Cron("*/5 * * * * *")`) with an overlap guard (`isRunning`) to prevent concurrent ticks.

### Execution Architecture

```text
[Cron: every 5s]
       │
       ▼
1. Redis SCAN (`hold_expiry:{*}`, COUNT 100) ──► extract active eventIds
       │
       ▼
2. For each eventId:
   `redisScripts.expireDue(eventId, nowMs)` ──► executes `expire_due.lua`
       │
       ├──► 0 seats freed ──► next event
       │
       └──► >= 1 seats freed:
             ├──► 3. Redis PUBLISH `seat-updates:{eventId}`
             │       payload: { eventId, seatIds, state: "AVAILABLE", source: "WORKER_EXPIRY" }
             └──► 4. (Optional) PostgreSQL `event_seats` sync
                     UPDATE status = 'AVAILABLE' WHERE eventId = :eventId AND seatId IN (...) AND status = 'HELD'
```

- **Resilience**: Per-event errors are isolated so one failing event does not block remaining events. If PostgreSQL is unavailable at startup or during a sync, the worker logs a warning and continues executing Redis expiry and Pub/Sub broadcasts.

## Environment Variables

Configured via `@urticketbuddy/config` (`loadEnv()`):

- `WORKER_PORT` (default `3002`)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (optional for `event_seats` sync)

## BullMQ Processors & Queues

- `hold-expiry`: Handles releasing seats when 10-minute hold timers expire
- `search-index`: Idempotently syncs `index`, `update`, and `delete` event jobs (`PUBLISHED` only; removes `DRAFT`/`CANCELLED`) to Elasticsearch with exponential backoff retries (`packages/contracts` schemas)
- `order-notifications`: Dispatches email/SMS confirmations
- `ticket-seed-rotation`: Rotates HMAC QR seeds periodically

## Reindex CLI

Run `pnpm search:reindex` (from root) or `pnpm --filter @urticketbuddy/worker search:reindex` to build a new versioned index (`events_v<n+1>`) in batches from PostgreSQL, atomically swap the `events` alias via `updateAliases`, and delete prior versioned indices.

### Elasticsearch Environment Variables

- `ELASTICSEARCH_NODE`, `ELASTICSEARCH_USERNAME`, `ELASTICSEARCH_PASSWORD`, `ELASTICSEARCH_API_KEY`, `ELASTICSEARCH_INDEX_ALIAS` (defaults to `events`)

## Testing

```bash
# Unit & Testcontainers integration tests (requires Docker for integration test)
pnpm --filter @urticketbuddy/worker test

# Unit tests only
pnpm --filter @urticketbuddy/worker test -- test/expiry.service.spec.ts src/health/health.controller.spec.ts
```
