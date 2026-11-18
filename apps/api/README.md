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

## Persistence Model (Polyglot)

- **PostgreSQL**: System of record for physical venues (`venues`), events (`events`), and individual seats (`event_seats`).
- **MongoDB**: Raw JSON venue layouts adhering to `VenueLayoutSchema` stored in `venue_layouts`.
- **Seat Generation**: Deterministic 2D coordinate calculations via `@urticketbuddy/venue-engine` with 1,000-seat chunked bulk insertions.

## Directory Structure

- `src/modules/<module>`: Domain modules (auth, users, admin, analytics, search, venues, events, seats, checkout, tickets, gate, resale)
- `src/common`: Ports, Zod schemas, DTO types, enums, error codes, and guards
