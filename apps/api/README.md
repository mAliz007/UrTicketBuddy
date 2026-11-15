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

## Directory Structure

- `src/modules/<module>`: Domain modules (auth, users, admin, analytics, search, venues, events, seats, checkout, tickets, gate, resale)
- `src/common`: Ports, Zod schemas, DTO types, enums, error codes, and guards
