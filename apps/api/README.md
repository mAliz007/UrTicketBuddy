# @urticketbuddy/api

Core backend REST API for UrTicketBuddy built as a NestJS modular monolith.

## Tech Stack

- NestJS 11
- TypeScript
- TypeORM (Postgres via PgBouncer on port 6432)
- ioredis, Mongoose, Elasticsearch

## Port & Endpoints

- Port: `3000`
- REST prefix: `/api/v1`
- Health check: `GET /api/v1/health` (reports dependency status for Postgres, Mongo, Redis, and Elasticsearch)
- Auth & RBAC: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me` (see [Auth Module](src/modules/auth/README.md))
- Venues: `POST /api/v1/venues`, `GET /api/v1/venues/:id` (see [Venues Module](src/modules/venues/README.md))
- Events: `POST /api/v1/events`, `GET /api/v1/events/:id`, `POST /api/v1/events/:id/generate-seats` (see [Events Module](src/modules/events/README.md))
- Checkout: `POST /api/v1/checkout/hold` — atomic Redis seat hold via `@urticketbuddy/redis-scripts` and Pub/Sub broadcast on `seat-updates:{eventId}` (see [Checkout Module](src/modules/checkout/README.md))
- Orders: `POST /api/v1/orders/checkout`, `GET /api/v1/orders/:id` (see [Orders Module](src/modules/orders/README.md))
- Dynamic QR Tickets: `GET /api/v1/tickets/:ticketId/dynamic-qr`, `PATCH /api/v1/tickets/:ticketId/rotate-key`, `GET /api/v1/users/me/tickets` (see [Tickets Module](src/modules/tickets/README.md))
- Gate Scanner: `POST /api/v1/gate/scan`, `GET /api/v1/gate/metrics` (see [Gate Module](src/modules/gate/README.md))
- Resale Marketplace: `POST /api/v1/resale/listings`, `PATCH /api/v1/resale/listings/:listingId`, `GET /api/v1/resale/listings`, `POST /api/v1/resale/listings/:listingId/purchase` (see [Resale Module](src/modules/resale/README.md))
- Admin Suite & Audit Log: `PATCH /api/v1/admin/orders/:id/flag`, `DELETE /api/v1/admin/tickets/:id`, `GET|PUT /api/v1/admin/settings/commission`, `PATCH /api/v1/admin/users/:id/suspend`, `PATCH /api/v1/admin/organizers/:id/approve`, `GET /api/v1/admin/audit-logs` (see [Admin Module](src/modules/admin/README.md))
- Organizer Analytics: `GET /api/v1/organizer/analytics/:eventId` (see [Analytics Module](src/modules/analytics/README.md))

## Persistence Model (Polyglot)

- **PostgreSQL**: System of record for physical venues (`venues`), events (`events`), individual seats (`event_seats`), orders (`orders`), order line items (`order_items`), tickets (`tickets`), gate scans (`gate_scans`), users (`users`), refresh tokens (`refresh_tokens`), platform settings (`platform_settings`), and append-only audit trail (`audit_logs` protected by trigger `trg_audit_logs_immutable`).
- **MongoDB**: Raw JSON venue layouts adhering to `VenueLayoutSchema` stored in `venue_layouts`.
- **Redis**: Fast transient seat state locks (`seat_lock`, `seat_sold`, `hold_expiry`, `user_holds`) operated atomically via `@urticketbuddy/redis-scripts` (`hold_seats.lua`, `confirm_sold.lua`).
- **Seat Generation**: Deterministic 2D coordinate calculations via `@urticketbuddy/venue-engine` with 1,000-seat chunked bulk insertions.

## Directory Structure

- `src/modules/<module>`: Domain modules (auth, users, admin, analytics, search, venues, events, seats, checkout, orders, tickets, gate, resale)
- `src/common`: Ports, Zod schemas, DTO types, enums, error codes, and guards

## Security Hardening & Production Safeguards

- **HTTP Security Headers**: Powered by `helmet` with secure defaults (HSTS, X-Content-Type-Options, X-Frame-Options, DNS Prefetch Control).
- **Strict CORS Policy**: Origin allowlist dynamically populated from comma-delimited `CORS_ORIGINS` environment variable (e.g., `http://localhost:5173,http://localhost:5174,http://129.221.182.252`). Wildcard origins are rejected in production.
- **Request Body Size Limits**: JSON and URL-encoded body limits restricted to `100kb` to thwart body-parser DoS attacks.
- **RFC 6585 Rate Limiting & 429 Handling**: `GlobalHttpExceptionFilter` intercepts NestJS `ThrottlerException` and maps it to the standard error envelope `{ error: { code: ErrorCode.TOO_MANY_REQUESTS, message, requestId } }` with an HTTP `Retry-After: 60` header.
- **Zero-Trust Log Redaction**: `LogRedactionInterceptor` recursively scrubs sensitive tokens and credentials (`password`, `passwordHash`, `accessToken`, `refreshToken`, `Authorization`, `Cookie`, `token`, `qrPayload`, `totpSecret`) from log payloads before output.
- **Tenant Isolation**: `OwnershipGuard` verifies organizer resource tenancy (`event.organizerId === user.organizerTenantId || event.organizerId === user.id`) across multi-tenant administrative and analytics operations.
- **Route Authorization Verification**: Automated route metadata scanner and persona matrix in `test/security-audit.e2e-spec.ts` guaranteeing zero unprotected or misconfigured endpoints.

## Testing & Concurrency Verification

Run unit, E2E, and typecheck suites (covering both `src/` and `test/`):

```bash
pnpm --filter @urticketbuddy/api typecheck
pnpm --filter @urticketbuddy/api lint
pnpm --filter @urticketbuddy/api test
```

- **1,000-User Contention & Invariants (`test/concurrency-invariants.e2e-spec.ts`)**: Simulates 1,000 concurrent buyers contending for a single seat, verifying exact `201`/`409` distribution, `Idempotency-Key` deduplication, compensating refunds (`refundPayment` + `unsellSeats`), and all 4 PostgreSQL + Redis invariants from [`infra/loadtests/README.md`](../../infra/loadtests/README.md).
- **Orders & Checkout E2E (`test/orders.e2e-spec.ts`)**: Validates checkout transactions, pessimistic row locking (`pessimistic_write`), and failure rollbacks (see [Orders Module](src/modules/orders/README.md)).
