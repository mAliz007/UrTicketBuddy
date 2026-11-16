# UrTicketBuddy Progress & Change Ledger

All notable changes, progress milestones, and ticket deliveries for the UrTicketBuddy platform are recorded in this ledger chronologically with completion dates and ticket keys.

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
