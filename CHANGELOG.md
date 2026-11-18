# UrTicketBuddy Progress & Change Ledger

All notable changes, progress milestones, and ticket deliveries for the UrTicketBuddy platform are recorded in this ledger chronologically with completion dates and ticket keys.

---

## [UTB-18] - 2026-11-18

### Production Dockerization & Continuous Delivery Pipeline

- **Ticket Key:** `UTB-18`
- **Completion Date:** 2026-11-18
- **Main Feature Branch:** `feat/UTB-18-docker-cd-pipeline`
  - Sub-task 1: `feat/UTB-18/dockerfiles`
  - Sub-task 2: `feat/UTB-18/cd-workflow`
  - Sub-task 3: `feat/UTB-18/tests`
- **Status:** Completed (Sub-tasks merged locally into `feat/UTB-18-docker-cd-pipeline`; PR ready for review; `main` unmerged)
- **Packages & Directories Modified:** `docker/`, `apps/api/`, `apps/realtime/`, `apps/worker/`, `infra/docker/`, `.github/workflows/`, `packages/config/`, `docs/`, `.dockerignore`, `docker-compose.prod.yml`, `.env.example`, `README.md`, `CHANGELOG.md`
- **Scope & Deliverables:**
  - **Root `.dockerignore`**: Created comprehensive Docker ignore file excluding `node_modules`, `dist`, `.git`, `.turbo`, `.env*`, `coverage`, `docs`, and frontend application sources (`apps/web/src`, `apps/web/public`, `apps/web/dist`) to guarantee backend container build isolation.
  - **Multi-Stage Dockerfiles (`docker/api.Dockerfile`, `docker/realtime.Dockerfile`, `docker/worker.Dockerfile`)**:
    - Implemented standardized 4-stage multi-stage Docker builds across all three backend services:
      1. `deps`: Node 22 Alpine, Corepack-pinned `pnpm@12.21.0`, layer-cached package manifests, and frozen lockfile installation.
      2. `build`: Compiles shared workspace packages and service targets (`pnpm --filter <app>... build`).
      3. `prod-deps`: Produces production-only dependencies and isolated workspace symlinks using `pnpm deploy --prod --prefer-offline`.
      4. `production`: Minimal runtime Alpine image executing as non-root `USER node` with `--chown=node:node`, process signal handling via `tini`, container health check with busybox `wget -q --spider`, proper `EXPOSE` port, and `CMD ["node", "dist/main.js"]`.
    - Synced app-level Dockerfiles (`apps/api/Dockerfile`, `apps/realtime/Dockerfile`, `apps/worker/Dockerfile`) and infra Dockerfiles to match the multi-stage standard.
  - **Production Docker Compose Stack (`docker-compose.prod.yml`)**:
    - Defines standalone production orchestration for `api`, `realtime`, and `worker` targeting `production` image stages.
    - Wires infrastructure services (`postgres`, `pgbouncer`, `mongo`, `redis`, `elasticsearch`) with healthcheck-based `depends_on`.
    - Configured restart policies (`unless-stopped`), port bindings, and environment variables referencing `.env.example`.
  - **GitHub Actions CD Pipeline (`.github/workflows/cd.yml`)**:
    - Triggered via `workflow_run` on completion of `CI Pipeline` on `main` when `conclusion == 'success'` (with `workflow_dispatch` fallback).
    - Configured sequential non-overlapping `concurrency` and minimal read permissions.
    - Automated deployment to Railway via `@railway/cli` for API, Realtime, and Worker services using `RAILWAY_TOKEN`.
    - Post-deploy verification probing `GET /api/v1/health` with exponential backoff (10 attempts, 10s intervals) and Railway status inspection for background services.
  - **Documentation & Verification Suite**:
    - Authored `docs/deployment.md` detailing CD flow diagrams, secret requirements, rollback playbooks, and troubleshooting guides.
    - Updated root `README.md` with production deployment and container reference.
    - Added automated Jest validation suite (`packages/config/src/docker-cd.spec.ts`) verifying Dockerfile stage contracts, compose dependencies, and workflow configurations.

---

## [UTB-8] - 2026-11-18

### Seat Hold API & Realtime WebSockets

- **Ticket Key:** `UTB-8`
- **Completion Date:** 2026-11-18
- **Main Feature Branch:** `feat/UTB-8-checkout-realtime`
  - Sub-task 1: `feat/UTB-8/api-checkout`
  - Sub-task 2: `feat/UTB-8/realtime-gateway`
  - Sub-task 3: `feat/UTB-8/tests`
- **Status:** Completed (Sub-tasks merged into `feat/UTB-8-checkout-realtime`; PR ready for review; `main` unmerged)
- **Packages & Directories Modified:** `apps/api`, `apps/realtime`, `CHANGELOG.md`, `.engram`
- **Scope & Deliverables:**
  - **Checkout NestJS Module (`apps/api/src/modules/checkout`)**:
    - Implemented `POST /api/v1/checkout/hold` accepting `{ eventId, seatIds }` validated against `HoldRequestSchema` (`@urticketbuddy/contracts`) and extracting `userId` from `x-user-id` header (temporary mock prior to UTB-3).
    - Integrated `RedisScriptsWrapper.holdSeats` from `@urticketbuddy/redis-scripts`.
    - Returns `409 Conflict` with `GlobalHttpExceptionFilter` envelope on hold failure (`SEAT_ALREADY_HELD`, etc.).
    - Publishes `{ eventId, seatIds, state: "HELD", userId }` to Redis Pub/Sub channel `seat-updates:{eventId}` on success and returns `{ eventId, userId, seatIds, expiresAt }`.
  - **Realtime WebSocket Gateway (`apps/realtime/src/gateway`)**:
    - Implemented `SeatUpdatesGateway` using `@nestjs/platform-socket.io` handling `join-event` messages to add sockets to `event:{eventId}` rooms.
    - Configured dedicated `ioredis` subscriber listening to `seat-updates:*` via `psubscribe` and broadcasting `seats-updated` to `event:{eventId}` rooms.
  - **Integration & Unit Tests (`apps/api/test`, `apps/realtime/test`)**:
    - Added Supertest E2E suite `apps/api/test/checkout-hold.e2e-spec.ts` verifying hold acquisition, Pub/Sub publishing, `409 Conflict` on already-held seats, `401` on missing `x-user-id`, and `400` on invalid input.
    - Added `socket.io-client` test `apps/realtime/test/seat-updates.gateway.spec.ts` verifying two clients in an event room both receive `seats-updated` after `holdSeats` + Pub/Sub publish.
    - Updated `apps/api/README.md`, `apps/realtime/README.md`, `apps/api/src/modules/checkout/README.md`, `apps/realtime/src/gateway/README.md`, and `CHANGELOG.md`.

---

## [UTB-10] - 2026-11-18

### Orders, Payment Gateway Integration, & Checkout Completion API

- **Ticket Key:** `UTB-10`
- **Completion Date:** 2026-11-18
- **Main Feature Branch:** `feat/UTB-10-orders-payment-api`
  - Sub-task 1: `feat/UTB-10-orders-payment-api-db-entities`
  - Sub-task 2: `feat/UTB-10-orders-payment-api-orders-module`
  - Sub-task 3: `feat/UTB-10-orders-payment-api-tests`
- **Status:** Completed (Sub-tasks merged into `feat/UTB-10-orders-payment-api`; PR ready for review; `main` unmerged)
- **Packages & Directories Modified:** `packages/contracts`, `packages/db`, `apps/api`, `README.md`, `CHANGELOG.md`, `.engram`
- **Scope & Deliverables:**
  - **TypeORM Entities & PostgreSQL Migrations (`packages/db`)**:
    - Implemented `Order` entity: `id` (uuid PK), `userId` (varchar indexed), `eventId` (uuid FK with covering index `idx_orders_event_id`), `totalAmount` (`numeric(12, 2)`), `currency` (`PKR`), `status` (`PENDING`, `COMPLETED`, `CANCELLED`, `REFUNDED`), `paymentGatewayRef` (varchar nullable).
    - Implemented `OrderItem` entity: `id` (uuid PK), `orderId` (uuid FK with covering index `idx_order_items_order_id`, on delete cascade), `eventSeatId` (uuid FK with covering index `idx_order_items_event_seat_id`), `price` (`numeric(12, 2)`).
    - Generated reversible TypeORM migration `1794936850000-UTB-10-init-orders.ts` with hashed foreign keys (`FK_80f390b083014fd69ec40b8c38c`, `FK_f1d359a55923bb45b057fbdab0d`, `FK_3d40cd9b9c9fab977c139cd4b11`) ensuring zero schema drift under `typeorm migration:generate --check`.
    - Passed all 4 database health checks via `pnpm db:check`.
  - **Contracts & Schemas (`packages/contracts/src/orders.ts`)**:
    - Created Zod schemas: `CheckoutRequestSchema`, `OrderItemDtoSchema`, `OrderResponseSchema`, and `OrderStatus` enum.
  - **Mock Payment Gateway Service (`apps/api/src/modules/orders/payment/mock-payment.service.ts`)**:
    - Implemented `PaymentProvider` interface supporting intent creation, webhook signature verification, and simulated charges (`tok_visa`, `tok_fail`).
  - **Orders Module & Checkout Pipeline (`apps/api/src/modules/orders`)**:
    - `POST /api/v1/orders/checkout`:
      1. **Active Hold Verification:** Verifies requested seats are actively locked by user in Redis via `@urticketbuddy/redis-scripts`. Rejects expired holds (`409 HOLD_EXPIRED`) or holds owned by another user (`409 SEAT_NOT_HELD_BY_YOU`).
      2. **Payment Processing:** Charges the payment gateway, returning `400 PAYMENT_FAILED` on card/token failure.
      3. **Atomic Lua Lock Confirmation:** Executes `confirm_sold.lua` via `RedisScriptsWrapper.confirmSold` atomically.
      4. **PostgreSQL ACID Transaction:** Executes `dataSource.transaction()` to insert the `Order`, insert all `OrderItem` line items, and atomically update `EventSeat.status` to `SOLD`.
      5. **Real-time Pub/Sub Broadcast:** Emits Redis event on `seat-updates:{eventId}` and `seat.state` with state `SOLD`.
      6. Returns completed order details with monetary amounts and timestamps.
    - `GET /api/v1/orders/:id`: Fetches order details with line items and event association. Returns `404 Not Found` if missing.
  - **Testing & Quality Verification**:
    - Unit test suites for `OrdersController` (2/2 passed) and `OrdersService` (11/11 passed).
    - Supertest E2E integration test suite (`apps/api/test/orders.e2e-spec.ts`) asserting successful checkout, transaction rollback on payment decline, hold expiration rejection, foreign user lock rejection, and order retrieval (6/6 passed).
    - Monorepo tests: 13/13 tasks passing (48/48 tests in `apps/api`).
    - Passed `pnpm lint`, `pnpm typecheck`, `pnpm db:check`, and `pnpm graphify`.

---

## [UTB-9] - 2026-11-17

### Venues & Events NestJS REST API with Polyglot Persistence

- **Ticket Key:** `UTB-9`
- **Completion Date:** 2026-11-17
- **Main Feature Branch:** `feat/UTB-9-venues-events-api`
  - Sub-task 1: `feat/UTB-9-venues-events-api-db-schemas`
  - Sub-task 2: `feat/UTB-9-venues-events-api-nestjs-modules`
  - Sub-task 3: `feat/UTB-9-venues-events-api-bulk-generation`
  - Sub-task 4: `feat/UTB-9-venues-events-api-tests`
- **Status:** Completed (Sub-tasks merged into `feat/UTB-9-venues-events-api`; PR ready for review; `main` unmerged)
- **Packages & Directories Modified:** `packages/db`, `apps/api`, `README.md`, `CHANGELOG.md`, `.engram`
- **Scope & Deliverables:**
  - **TypeORM Entities & PostgreSQL Migrations (`packages/db`)**:
    - Implemented `Venue` entity: `id` (uuid PK), `name` (varchar), `location` (varchar), `layoutMongoId` (varchar).
    - Implemented `Event` entity: `id` (uuid PK), `venueId` (uuid FK with covering index `idx_events_venue_id`), `name` (varchar), `startTime` (timestamptz), `status` (varchar).
    - Implemented `EventSeat` entity: `id` (uuid PK), `eventId` (uuid FK with covering index `idx_event_seats_event_id`), `seatId` (varchar deterministic `<section>-<row>-<number>`), `tierId` (varchar nullable), `x` (float), `y` (float), `status` (varchar default `AVAILABLE`), unique constraint `uq_event_seats_event_seat`.
    - Added reversible TypeORM migration `1794836850000-UTB-9-init-venues-events.ts` creating tables, foreign keys, and indexes, verified with `pnpm db:check`.
  - **Mongoose Schema (`apps/api/src/modules/venues/schemas/venue-layout.schema.ts`)**:
    - Created Mongoose schema `VenueLayout` storing raw venue layout configuration conforming to `VenueLayoutSchema` (from `@urticketbuddy/contracts`).
  - **Venues NestJS Module (`apps/api/src/modules/venues`)**:
    - `POST /api/v1/venues`: Validates incoming layout JSON using `parseLayout` from `@urticketbuddy/venue-engine`. Returns `400 Bad Request` on invalid schema/geometry. Persists layout to MongoDB and stores venue in PostgreSQL with MongoDB `_id` in `layoutMongoId`.
    - `GET /api/v1/venues/:id`: Fetches PostgreSQL venue metadata and joins the complete MongoDB layout document.
  - **Events NestJS Module & Bulk Seat Generation (`apps/api/src/modules/events`)**:
    - `POST /api/v1/events`: Creates an event associated with an existing venue.
    - `GET /api/v1/events/:id`: Retrieves event details.
    - `POST /api/v1/events/:id/generate-seats`: Mathematically calculates 2D coordinates and metadata for all seats across grid, arc, and table sections using `@urticketbuddy/venue-engine`. Sets initial seat status to `AVAILABLE`.
    - **Chunked Bulk Insert**: Batches seat insertions into PostgreSQL in chunks of 1,000 to prevent database query size and memory exhaustion.
    - Implemented `EventSeatCatalogPort` for querying seat availability.
  - **Testing & Quality Verification**:
    - Unit test suites for `VenuesService`, `VenuesController`, `EventsService`, and `EventsController`.
    - E2E Supertest integration suite (`apps/api/test/venues-events.e2e-spec.ts`) testing 400 rejection on invalid layouts, joined venue retrieval, and exact mathematical seat count persistence.
    - Passed all quality gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:check`, and `pnpm graphify`.

---

## [UTB-2] - 2026-11-16

### CI Pipeline & TypeORM Migration Tooling

- **Ticket Key:** `UTB-2`
- **Completion Date:** 2026-11-16
- **Main Feature Branch:** `ci/UTB-2-ci-migrations`
  - Sub-task 1: `ci/UTB-2/typeorm-scripts`
  - Sub-task 2: `ci/UTB-2/db-checks`
  - Sub-task 3: `ci/UTB-2/github-actions`
  - Sub-task 4: `ci/UTB-2/docs`
- **Status:** Completed (Sub-tasks merged into `ci/UTB-2-ci-migrations`; PR ready for review)
- **Packages & Directories Modified:** `.github`, `packages/db`, `packages/config`, `apps/*`, `infra/docker`, `scripts`, `docs`
- **Scope & Deliverables:**
  - **CI Workflow Pipeline (`.github/workflows/ci.yml`)**:
    - Implemented GitHub Actions CI workflow running on pushes and pull requests targeting `main`.
    - Integrated pnpm store caching (`pnpm/action-setup@v4`, `actions/setup-node@v4` with `cache: 'pnpm'`) and Turborepo caching (`actions/cache@v4` with `.turbo`).
    - Configured parallel jobs:
      - `lint-typecheck`: Validates ESLint and strict `tsc --noEmit` across all workspace projects.
      - `unit`: Parallel execution of Jest unit test suites across all packages and apps.
      - `integration`: Spawns live service containers (PostgreSQL 16, MongoDB 7, Redis Stack with RedisBloom) and verifies integration and service health.
      - `docker-build`: Parallel matrix builds for `api`, `realtime`, `worker`, and `web` images using Docker Buildx and GitHub Actions cache.
      - `migrations`: Deterministic 5-step transactional verification (Up $\rightarrow$ Revert $\rightarrow$ Up $\rightarrow$ Schema Drift Check $\rightarrow$ DB Consistency Checks).
  - **TypeORM DataSource & Migration Tooling (`packages/db`)**:
    - Created TypeORM DataSource in `packages/db/src/data-source.ts` reading environment configuration strictly from `@urticketbuddy/config`.
    - Enforced `synchronize: false` across all environments as mandated by architectural decisions D-7 and D-8.
    - Standardized migration scripts: `db:migrate`, `db:revert`, `db:generate`, and `db:check`.
    - Added baseline migration `1794836828550-UTB-2-init-extensions.ts` enabling PostgreSQL `pgcrypto` and `uuid-ossp` extensions with reversible `down()` step.
    - Added unit test asserting strict adherence to migration filename format `<timestamp>-UTB-<n>-<description>.ts`.
  - **Database Consistency Checks (`scripts/db-check.ts`, `packages/db/src/check.ts`)**:
    - Built comprehensive validation script enforcing four critical database invariants:
      1. Zero-tolerance check ensuring `synchronize: true` never appears anywhere in the codebase.
      2. Primary key validation across database tables and entity metadatas.
      3. Covering index validation ensuring every foreign key column has an index on its leading columns.
      4. Mongoose schema index validation ensuring all index definitions compile and load cleanly.
    - Added unit test suite `packages/db/src/check.spec.ts` validating passing states and failure detections.
  - **Docker Containerization (`infra/docker/`, `apps/*/Dockerfile`)**:
    - Created production-ready multi-stage Dockerfiles for NestJS microservices (`api`, `realtime`, `worker`) and frontend SPA (`web` with Nginx Alpine).
  - **Documentation & Protection Policies**:
    - Created `docs/ci.md` specifying exact GitHub branch protection rules for `main` and required status checks.
    - Added `TODO: [UTB-18]` for ephemeral Railway preview deployment workflow.
    - Updated `packages/db/README.md` and root `README.md` with complete migration guides and quality gate architecture.

---

## [UTB-5] - 2026-11-16

### Atomic Redis Seat-Locking Lua Engine

- **Ticket Key:** `UTB-5`
- **Completion Date:** 2026-11-16
- **Main Feature Branch:** `feat/UTB-5-seat-lock-lua`
  - Sub-task 1: `feat/UTB-5/contracts`
  - Sub-task 2: `feat/UTB-5/lua-scripts`
  - Sub-task 3: `feat/UTB-5/integration-tests`
- **Status:** Completed (Sub-tasks merged into `feat/UTB-5-seat-lock-lua`; PR ready for review)
- **Packages Modified:** `packages/redis-scripts`, `packages/contracts`
- **Scope & Deliverables:**
  - **Contracts & Schemas (`packages/contracts`)**:
    - Created `packages/contracts/src/seats.ts` exporting strict `HoldRequestSchema` and `HoldResponseSchema` (with `expiresAt`).
    - Added error codes `SEAT_NOT_HELD_BY_YOU` and `TOO_MANY_SEATS` alongside `SEAT_ALREADY_HELD` and `HOLD_EXPIRED` in `ErrorCode` enum (`packages/contracts/src/errors.ts`).
    - Enforced strict validation on `SeatStateEventSchema` with optional `expiresAt` (`packages/contracts/src/sockets.ts`).
  - **Atomic Lua Concurrency Engine (`packages/redis-scripts/lua/`)**:
    - Key slot affinity ensured via `{eventId}` hash tags across all locking keys: `seat_lock:{<eventId>}:<seatId>`, `seat_sold:{<eventId>}`, `hold_expiry:{<eventId>}`, `user_holds:{<eventId>}:<userId>`, `hold_extended:{<eventId>}:<userId>`.
    - `hold_seats.lua`: Atomically checks `seat_sold` and live locks owned by others; prunes stale user holds; enforces `maxPerUser`; atomically executes `SET ... EX 600`, `ZADD hold_expiry`, and `SADD user_holds`.
    - `release_seats.lua`: Verifies lock ownership before deleting locks and clearing tracking sets (`SEAT_NOT_HELD_BY_YOU` on unauthorized attempt).
    - `confirm_sold.lua`: Validates active hold ownership and moves seats to `seat_sold` while pruning active locks.
    - `unsell_seats.lua`: Admin revocation removing seats from `seat_sold`.
    - `extend_hold.lua`: Enforces a strict one-time 120s grace period extension per user per event.
    - `expire_due.lua`: Removes expired seats whose locks have timed out, freeing seat IDs atomically.
  - **Typed TypeScript Wrappers (`packages/redis-scripts/src/index.ts`)**:
    - Registered all 6 scripts with `ioredis` `defineCommand` and typed module augmentation.
    - Implemented `RedisScriptsWrapper` (`RedisSeatLockEngine`) exposing `holdSeats`, `releaseSeats`, `confirmSold`, `unsellSeats`, `extendHold`, `expireDue`, `getSnapshot(eventId)`, and `getCounts(eventId)`.
  - **Testing & Concurrency Verification (`packages/redis-scripts/src/`)**:
    - Unit tests validating Lua scripts and key naming conventions.
    - Testcontainers integration test suite (`redis/redis-stack-server:latest`) verifying 500 simultaneous hold attempts on a single seat (exactly 1 winner, 499 failures) and zero partial locks on overlapping multi-seat holds.
  - **Documentation**:
    - Documented Lua scripts, keys, and TypeScript usage in `packages/redis-scripts/README.md`, `packages/contracts/README.md`, `packages/README.md`, and root `README.md`.

---

## [UTB-7] - 2026-11-15

### Parametric Venue Engine Core (Backend Math Phase)

- **Ticket Key:** `UTB-7`
- **Completion Date:** 2026-11-15
- **Main Feature Branch:** `feat/UTB-7-venue-engine`
  - Sub-task 1: `feat/UTB-7-venue-engine-contracts`
  - Sub-task 2: `feat/UTB-7-venue-engine-generators`
  - Sub-task 3: `feat/UTB-7-venue-engine-tests`
- **Status:** Completed (Sub-tasks merged into `feat/UTB-7-venue-engine`; PR ready for review)
- **Packages Modified:** `packages/venue-engine`, `packages/contracts`
- **Scope & Deliverables:**
  - **Contracts & Schemas (`packages/contracts`)**:
    - Created `packages/contracts/src/venue.ts` exporting strict `VenueLayoutSchema` (version: 1) and `SeatNodeSchema` (`{ id, x, y, rotation, sectionId, row, number, tierId?, state? }`).
    - Defined primitive schemas: `GridSectionConfigSchema`, `ArcSectionConfigSchema`, and `TableClusterConfigSchema`.
    - Implemented trigonometric conversion utilities (`degToRad`, `radToDeg`). Runtime math strictly operates in radians, while external serialization exposes degrees for human readability.
  - **2D Math Generators (`packages/venue-engine/src/generators/`)**:
    - `generateGrid`: Implemented 2D Cartesian grid coordinate generation with row staggering (`staggerOffset`), seat spacing (`gapX`, `gapY`), and aisle management (`aisleColumns`, `aisleWidth`).
    - `generateArc`: Implemented concentric curved rows using $\text{maxSeats} = \lfloor \frac{R \cdot \Delta\theta + gapX}{seatWidth + gapX} \rfloor$. Calculates Cartesian coordinates $(Xc + R\cos\theta, Yc + R\sin\theta)$ and sets rotation $\theta + 90^\circ$ so each seat faces directly toward the origin.
    - `generateTableCluster`: Implemented radial seat placement around circular tables with translate and rotate group transform metadata.
  - **Data Utilities (`packages/venue-engine/src/utils/`)**:
    - Deterministic seat IDs `<sectionId>-<row>-<number>` (`buildSeatId`, `parseSeatId`).
    - Spreadsheet-style row label generator (`rowToLabel`: `0 -> 'A'`, `25 -> 'Z'`, `26 -> 'AA'`).
    - Bounding box calculator (`boundingBox`: min/max X/Y, width, height).
    - Andrew's monotone chain $O(n \log n)$ convex hull polygon (`convexHull`) and section aggregation (`sectionAggregates`) for Level-of-Detail rendering.
    - Layout parser and serializer (`parseLayout`, `serializeLayout`) with typed `InvalidLayoutError` and geometric edge-case validation.
  - **Testing & Performance (`packages/venue-engine/src/__tests__/`)**:
    - Property-based tests via `fast-check` asserting exact seat count formulas, center-oriented rotation vectors, non-overlapping seat distances ($\ge seatWidth$), and serialization round-trip equality.
    - 10,000 seat performance benchmark executing in **43 ms** (passing well below the 200 ms requirement).
  - **Documentation**:
    - Created `packages/venue-engine/README.md` with complete API docs and runnable `generateArc` usage example.

---

## [UTB-1] - 2026-11-15

### Monorepo Scaffold & Base Infrastructure

- **Ticket Key:** `UTB-1`
- **Completion Date:** 2026-11-15
- **Main Feature Branch:** `chore/UTB-1-monorepo-scaffold`
  - Sub-task 1: `chore/UTB-1-monorepo-scaffold-packages`
  - Sub-task 2: `chore/UTB-1-monorepo-scaffold-docker`
  - Sub-task 3: `chore/UTB-1-monorepo-scaffold-apps`
  - Sub-task 4: `chore/UTB-1-monorepo-scaffold-docs`
- **Status:** Completed & Merged into `main` (Pull Request #1)
- **Scope & Deliverables:**
  - Initialized Turborepo + pnpm monorepo layout with 4 applications (`web`, `api`, `realtime`, `worker`) and 5 shared packages (`contracts`, `config`, `db`, `redis-scripts`, `venue-engine`).
  - Implemented Docker Compose suite with PostgreSQL 16, PgBouncer (transaction mode on 6432), MongoDB 7, Redis Stack (RedisBloom), Elasticsearch 8, Nginx reverse proxy, and PgAdmin.
  - Added dependency healthchecks on all services with `GET /api/v1/health`.
  - Configured root scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `db:migrate`, `up`, `down`).
  - Added Husky, lint-staged, and commitlint enforcing Conventional Commits.
  - Added `.github/CODEOWNERS`, pull request template reflecting DoD, `.env.example`, and architectural decision record `docs/adr/0001-architecture.md` (decisions D-1 to D-7).
  - Generated initial workspace dependency graph using `graphify`.
  - Documented complete local developer setup in root `README.md`.
