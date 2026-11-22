# 1. Architecture Decisions Record (ADR-0001)

## Status

Accepted (Frozen)

## Context

UrTicketBuddy is a high-concurrency event ticketing platform supporting parametric venue layouts, atomic Redis + Lua seat holds, dynamic time-decaying QR tickets, and capped P2P resale. To ensure consistency, high throughput, and developer coordination across three team members, core architectural decisions are formalized and frozen.

## Decisions

### D-1: Technology Stacks

- **Backend**: NestJS with TypeScript running under Node.js.
- **Frontend**: React single-page application built with Vite and Tailwind CSS. Next.js is explicitly excluded.

### D-2: Ticket Lifecycle Statuses

- Tickets transition linearly: `ISSUED` -> `CHECKED_IN`.
- Terminal cancellation states: `VOID` and `REVOKED`.

### D-3: Dynamic QR Ticket Generation & Rotation

- QR validation tokens are HMAC-SHA256 computed over `ticketId` and a rolling 30-second time window.
- The cryptographic key is derived via HKDF using `MASTER_TICKET_SECRET` and `ticketId + seed_version`.
- Ticket invalidation and rotation is executed by incrementing `seed_version`.

### D-4: Payment Gateway Interface

- All payment processing is decoupled through the `PaymentProvider` interface.
- Supported providers: Stripe (test mode), Safepay, and `FakeProvider` for testing.

### D-5: Deployment Strategy

- Primary live deployment on Oracle Cloud Infrastructure (OCI) Always Free Tier (Ampere A1 ARM64 / Docker Compose & K3s) per ADR-0002.
- Containerized Kubernetes manifests validated using local `kind` clusters. Railway and AWS infrastructure remain optional.

### D-6: Backend Service Boundaries

The backend consists of exactly three decoupled services:

1. `apps/api`: Modular monolith handling REST endpoints under `/api/v1`.
2. `apps/realtime`: Socket.io WebSocket gateway with Redis adapter for live seat state streaming.
3. `apps/worker`: BullMQ background job processing engine.

### D-7: Standard Libraries & Conventions

- **Persistence & Caching**: TypeORM (Postgres via PgBouncer on port 6432), Mongoose (MongoDB for venue layouts only), ioredis (Redis Stack with RedisBloom for transient seat holds), Elasticsearch (read model).
- **Queues**: BullMQ with Redis backing.
- **Validation**: Zod schemas defined in `packages/contracts`.
- **Testing**: Jest, Supertest, Testcontainers, k6 (load testing), Vitest and Playwright (web).
- **Monorepo**: pnpm workspaces and Turborepo.
- **Conventions**: Money is always represented in integer minor units (e.g. cents). All timestamps are strictly UTC. Identifiers are UUIDs except seat identifiers, which follow the parametric format `<sectionId>-<row>-<number>`.

## Consequences

- Clean separation of concerns between transactional writes (Postgres), layout documents (Mongo), fast concurrency locks (Redis), and event streaming.
- Monorepo tooling enables independent compilation, strict boundaries (`apps` never import from each other), and deterministic CI workflows.
