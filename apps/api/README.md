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
- Venues: `POST /api/v1/venues`, `GET /api/v1/venues/:id` (see [Venues Module](src/modules/venues/README.md))
- Events: `POST /api/v1/events`, `GET /api/v1/events/:id`, `POST /api/v1/events/:id/generate-seats` (see [Events Module](src/modules/events/README.md))
- Checkout: `POST /api/v1/checkout/hold` — atomic Redis seat hold via `@urticketbuddy/redis-scripts` and Pub/Sub broadcast on `seat-updates:{eventId}` (see [Checkout Module](src/modules/checkout/README.md))
- Orders: `POST /api/v1/orders/checkout`, `GET /api/v1/orders/:id` (see [Orders Module](src/modules/orders/README.md))

## Persistence Model (Polyglot)

- **PostgreSQL**: System of record for physical venues (`venues`), events (`events`), individual seats (`event_seats`), orders (`orders`), and order line items (`order_items`).
- **MongoDB**: Raw JSON venue layouts adhering to `VenueLayoutSchema` stored in `venue_layouts`.
- **Redis**: Fast transient seat state locks (`seat_lock`, `seat_sold`, `hold_expiry`, `user_holds`) operated atomically via `@urticketbuddy/redis-scripts` (`hold_seats.lua`, `confirm_sold.lua`).
- **Seat Generation**: Deterministic 2D coordinate calculations via `@urticketbuddy/venue-engine` with 1,000-seat chunked bulk insertions.

## Directory Structure

- `src/modules/<module>`: Domain modules (auth, users, admin, analytics, search, venues, events, seats, checkout, orders, tickets, gate, resale)
- `src/common`: Ports, Zod schemas, DTO types, enums, error codes, and guards
