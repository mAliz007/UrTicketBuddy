# UrTicketBuddy Progress & Change Ledger

All notable changes, progress milestones, and ticket deliveries for the UrTicketBuddy platform are recorded in this ledger chronologically with completion dates and ticket keys.

---

## [UTB-21] - 2026-11-23

### Security Audit, Route Authorization Matrix & Production Hardening

- **Ticket Key:** `UTB-21`
- **Completion Date:** 2026-11-23
- **Main Feature Branch:** `chore/UTB-21-security-hardening`
  - Sub-task 1: `chore/UTB-21-security-hardening-http-throttling` (Helmet, CORS allowlist, 100kb body limit, ThrottlerException RFC 6585 mapping, LogRedactionInterceptor, Nginx rate limit zones)
  - Sub-task 2: `chore/UTB-21-security-hardening-auth-matrix-tests` (Route metadata scanner, 5-persona Role × Route Matrix test suite, OwnershipGuard tenant isolation, token replay verification)
  - Sub-task 3: `chore/UTB-21-security-hardening-ci-owasp-docs` (CI supply-chain security workflows, OWASP Top 10 audit report docs/security-audit.md)
- **Status:** Completed & Verified (Backend & Security Phase Only: 52 automated route security tests passing, 100% monorepo pass)
- **Hotfix (2026-11-25):** Added `express` to `@urticketbuddy/api` production dependencies (`apps/api/package.json`) and updated `pnpm-lock.yaml`, resolving runtime `MODULE_NOT_FOUND` error for `express` during containerized production deployment in OCI CD pipeline.
- **Packages & Directories Modified:** `packages/config/`, `apps/api/`, `infra/nginx/`, `.github/workflows/`, `docs/`, `README.md`, `CHANGELOG.md`
- **Scope & Deliverables:**
  - **HTTP Hardening, Body Limits & Rate Limiting (`apps/api`, `infra/nginx`)**:
    - Integrated `helmet` in `apps/api/src/main.ts` for automated security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, DNS Prefetch Control).
    - Enforced strict origin validation via `CORS_ORIGINS` loaded through `@urticketbuddy/config` Zod schema, rejecting wildcards and unauthorized origins.
    - Added body-parser request size limit (`100kb`) for JSON and URL-encoded bodies in `apps/api/src/main.ts` to neutralize body parser payload inflation attacks.
    - Updated `GlobalHttpExceptionFilter` to intercept NestJS `ThrottlerException` and map it to `{ error: { code: ErrorCode.TOO_MANY_REQUESTS, message, requestId } }` with standard HTTP `Retry-After: 60` response header per RFC 6585.
    - Implemented `LogRedactionInterceptor` (`apps/api/src/common/interceptors/log-redaction.interceptor.ts`) recursively scrubbing sensitive credentials (`password`, `passwordHash`, `accessToken`, `refreshToken`, `Authorization`, `Cookie`, `token`, `qrPayload`, `totpSecret`) from logging streams.
    - Updated `infra/nginx/nginx.conf` with dedicated `limit_req_zone` definitions (`auth_limit` 5r/s [burst 10], `checkout_limit` 10r/s [burst 15], `orders_limit` 10r/s [burst 20], `gate_scan_limit` 30r/s [burst 50], `resale_limit` 10r/s [burst 20]) and location routing rules.
  - **Automated Route Metadata Audit Scanner & Role × Route Matrix (`apps/api/test/security-audit.e2e-spec.ts`)**:
    - Built programmatic route scanner auditing all registered NestJS controllers using `ModulesContainer` and `Reflector`, verifying that every route is explicitly marked with `@Public()` or guarded by `JwtAuthGuard` and `@Roles(...)`.
    - Executed matrix verification across 5 user personas (`Unauthenticated`, `CUSTOMER`, `GATE_STAFF`, `ORGANIZER`, `ADMIN`) across 12+ API modules, asserting exact 401 Unauthorized, 403 Forbidden, and 200/201 Success responses.
    - Verified multi-tenant organizer isolation via `OwnershipGuard` ensuring non-owning organizers receive 403 Forbidden while resource owners and admins succeed.
    - Re-verified refresh token family revocation upon token reuse detection and sensitive credential log scrubbing across interceptors.
    - All 52 automated security audit tests passing in `security-audit.e2e-spec.ts`.
  - **CI Supply-Chain Gates & OWASP Top 10 Report (`docs/security-audit.md`, `.github/workflows`)**:
    - Created dedicated `.github/workflows/security.yml` and added additive security job to `.github/workflows/ci.yml` running `pnpm audit --audit-level=high` and automated route security tests.
    - Authored exhaustive `docs/security-audit.md` mapping OWASP Top 10 categories (A01–A10) to exact code implementations, guards, Lua scripts, and passing test cases.

---

## [UTB-16] - 2026-11-23

### Admin Suite, Fraud & Ticket Revocation Engine, Append-Only Audit Log & Organizer Analytics

- **Ticket Key:** `UTB-16`
- **Completion Date:** 2026-11-23
- **Main Feature Branch:** `feat/UTB-16-admin-analytics-audit`
  - Sub-task 1: `feat/UTB-16-admin-analytics-audit-db` (Entities, migrations, trigger immutability)
  - Sub-task 2: `feat/UTB-16-admin-analytics-audit-admin` (Admin module, fraud flag, ticket revocation, platform settings)
  - Sub-task 3: `feat/UTB-16-admin-analytics-audit-analytics` (Organizer analytics, tenant isolation, velocity buckets)
  - Sub-task 4: `feat/UTB-16-admin-analytics-audit-tests` (Unit and Supertest E2E verification)
  - Sub-task 5: `feat/UTB-16-admin-analytics-audit-tester-docs` (Tester app catalog, CI/CD trigger sync, and docs)
  - Sub-task 6: `feat/UTB-16-admin-analytics-audit-fixes` (Transaction manager atomicity in AuditService, order flagging idempotency guard, and unit/E2E coverage)
- **Status:** Completed & Verified (Backend Phase Only: 18 unit tests, 5 Supertest E2E assertions, 100% monorepo pass)
- **Packages & Directories Modified:** `packages/contracts/`, `packages/db/`, `apps/api/`, `apps/tester/`, `apps/worker/`, `.github/workflows/`, `docker/`, `README.md`, `CHANGELOG.md`
- **Scope & Deliverables:**
  - **Endpoint Workbench Catalog Integration (`apps/tester`)**:
    - Expanded REST catalog with **Admin Suite & Fraud Control** (`/api/v1/admin/orders/:orderId/flag`, `/api/v1/admin/tickets/:ticketId`, `/api/v1/admin/settings/commission` GET/PUT, `/api/v1/admin/users/:userId/suspend`, `/api/v1/admin/organizers/:userId/approve`, `/api/v1/admin/audit-logs`).
    - Added **Organizer Analytics** endpoint (`/api/v1/organizer/analytics/:eventId`) to tester workbench with pre-configured parameters and payload samples.
    - Updated `apps/tester/README.md` and verified clean production build (`pnpm --filter @urticketbuddy/tester build`).
  - **CI/CD Triggers & Dockerfile Integrity**:
    - Synced `.github/workflows/ci.yml` and `.github/workflows/cd.yml` with `origin/main` commit `83a294e`, restoring automated CI testing across `feat/**` branches and post-CI CD deployment triggers.
    - Added `COPY apps/tester/package.json ./apps/tester/` across all multi-stage Dockerfiles (`docker/api.Dockerfile`, `docker/realtime.Dockerfile`, `docker/worker.Dockerfile`, `apps/api/Dockerfile`, `apps/realtime/Dockerfile`, `apps/worker/Dockerfile`, `apps/web/Dockerfile`) to prevent Docker layer lockfile discrepancies.
    - Added clean `moduleRef.close()` teardown in `apps/worker/test/expiry.integration.spec.ts` preventing open handle warnings in CI.
  - **Database Immutability & Entities (`packages/db`)**:
    - Created `PlatformSetting` entity (`platform_settings`) with unique index `idx_platform_settings_key` and default `commission_rate_percent = '10'`.
    - Created `AuditLog` entity (`audit_logs`) with covering indices `idx_audit_logs_actor_id`, `idx_audit_logs_action`, and `idx_audit_logs_created_at`.
    - Added `isSuspended` column (boolean, default false) to `User` entity (`users`).
    - Created reversible migration `1795136850000-UTB-16-init-admin-audit.ts` adding PostgreSQL trigger `trg_audit_logs_immutable` and trigger function `audit_logs_immutable_fn()`, strictly aborting any `UPDATE` or `DELETE` with a database-level SQL exception.
    - Added `organizerId` column to `events` table with index `idx_events_organizer_id` to establish tenant ownership boundaries.
    - Verified all 4 database consistency checks pass cleanly (`pnpm db:check`).
  - **Admin Suite & Fraud Mitigation (`apps/api/src/modules/admin`)**:
    - Implemented `AdminController` with all routes guarded by `JwtAuthGuard` and `RolesGuard` restricted to `UserRole.ADMIN`.
    - `PATCH /api/v1/admin/orders/:orderId/flag`: Marks order status as `FLAGGED` and increments `seedVersion` on all associated tickets inside a database transaction, instantly invalidating HMAC-SHA256 dynamic QR tokens at the turnstiles.
    - `DELETE /api/v1/admin/tickets/:ticketId`: Revokes ticket (`status = 'REVOKED'`), increments `seedVersion`, restores `EventSeat.status = 'AVAILABLE'` transactionally, invokes `RedisScriptsWrapper.unsellSeats` to remove the seat from `seat_sold:{eventId}`, and broadcasts `AVAILABLE` state to real-time clients across channels `seat-updates:{eventId}` and `seat.state`. Includes guard against re-revoking already revoked tickets.
    - `GET & PUT /api/v1/admin/settings/commission`: Reads and updates global platform commission rate bounded between 0% and 50%, backing `PlatformSettingsPort`.
    - `PATCH /api/v1/admin/users/:userId/suspend`: Suspends user accounts (`isSuspended = true`) and revokes all issued refresh tokens in `refresh_tokens`.
    - `PATCH /api/v1/admin/organizers/:userId/approve`: Approves organizer accounts and provisions unique `organizerTenantId`.
    - `GET /api/v1/admin/audit-logs`: Exposes paginated, filterable audit trail by `action`, `actorId`, and `entityType`.
  - **Audit Logging Subsystem (`AuditService` & `AuditLogInterceptor`)**:
    - Created `AuditService` exposing `recordLog` and `getLogs` with zero update/delete capabilities.
    - Provided `AUDIT_LOG_REPOSITORY` with a runtime Proxy guard rejecting any mutation attempts (`update`, `delete`, `remove`, `softDelete`, `clear`).
    - Implemented `AuditLogInterceptor` for automated mutation logging across administrative and sensitive platform operations (bound to `GateController`).
    - Bound `AuthService` token replay detection to log `TOKEN_REUSE_DETECTED` into audit trail.
  - **Organizer Analytics API (`apps/api/src/modules/analytics`)**:
    - `GET /api/v1/organizer/analytics/:eventId`: Protected for `ORGANIZER` and `ADMIN` roles. Enforces strict tenant ownership isolation (`event.organizerId === user.organizerTenantId || event.organizerId === user.id`), returning `403 Forbidden` for other organizers while permitting `ADMIN` bypass.
    - Computes minor-unit `totalRevenue`, `ticketsSold`, venue `totalCapacity`, `occupancyRate` percentage, 5-minute bucketed entry throughput from `gate_scans` (`result = 'VALID'`), real-time Redis seat holds via `RedisScriptsWrapper.getCounts`, and secondary resale market statistics.
  - **Comprehensive Verification Suite**:
    - 21/21 Test suites and 145/145 tests passing in `@urticketbuddy/api` (including unit tests for `AuditService`, `AdminService`, `AnalyticsService`, and 5/5 Supertest E2E assertions in `admin-analytics.e2e-spec.ts`).
    - Clean TypeScript compilation (`tsc --noEmit`), zero ESLint errors, and clean `pnpm graphify` AST extraction.

---

## [UTB-22] - 2026-11-22

### Centralized Space to Hit and Test Endpoints (Endpoint Tester Workbench)

- **Ticket Key:** `UTB-22`
- **Completion Date:** 2026-11-22
- **Main Feature Branch:** `feat/UTB-22-endpoint-tester`
  - Sub-task 1: `feat/UTB-22/tester-scaffold`
  - Sub-task 2: `feat/UTB-22/endpoint-catalog`
  - Sub-task 3: `feat/UTB-22/workbench-ui`
  - Sub-task 4: `feat/UTB-22/token-and-qr-helpers`
- **Status:** Completed & Integrated (Running on dedicated port 5174 via `pnpm tester`)
- **Packages & Directories Modified:** `apps/tester/`, `apps/README.md`, `package.json`, `README.md`, `CHANGELOG.md`
- **Scope & Deliverables:**
  - **Dedicated Postman-like Workbench (`apps/tester`)**:
    - Created standalone React 18 + Vite + Tailwind CSS developer workspace operating on dedicated port `5174`, ensuring zero interference with the main customer-facing frontend (`apps/web` on `5173`).
  - **Exhaustive Endpoint Catalog (`apps/tester/src/data/endpoints.ts`)**:
    - Pre-built request collections covering Authentication & RBAC, Venues, Events & Discovery, Realtime Seat Selection, Orders & Checkout, Tickets & Wallet, Gate QR Scans, and System Health.
  - **Auto-Token Capture & Bearer Injection**:
    - Automatic JSON inspection of auth responses to immediately store and apply JWT access tokens across all authenticated routes.
    - Added instant role quick-presets (`customer`, `organizer`, `admin`, `gate_staff`) to test RBAC authorization guards.
  - **Idempotency Header & Dynamic QR Visualizer**:
    - One-click UUID generator for `Idempotency-Key` headers.
    - Embedded dynamic HMAC-SHA256 QR code generator rendering live SVG scannable tickets from `/api/v1/tickets/:id/qr` payload responses.
  - **DevOps History & cURL Export**:
    - One-click "Copy as cURL" generator formatting shell-ready commands.
    - Persistent request/response history in `localStorage` tracking HTTP status, payload sizes, and round-trip execution latency (`ms`).
  - **Workspace & Monorepo Integration**:
    - Registered root script `"tester": "pnpm --filter @urticketbuddy/tester dev"`.
    - Documented port allocation (`5174`), architecture, and testing runbook in `apps/tester/README.md` and root `README.md`.

---

## [UTB-19] - 2026-11-22

### CDN Caching, Signed Object Storage, Automated Multi-DB Backups, K8s Manifests & Nightly Data Checker

- **Ticket Key:** `UTB-19`
- **Completion Date:** 2026-11-22
- **Main Feature Branch:** `feat/UTB-19-cdn-backups`
  - Sub-task 1: `feat/UTB-19-cdn-backups-media-cdn` (CDN Caching & Signed Media Upload API)
  - Sub-task 2: `feat/UTB-19-cdn-backups-db-drills` (Automated Multi-DB Backups & Restore Drill Scripts)
  - Sub-task 3: `feat/UTB-19-cdn-backups-k8s` (Kubernetes Production Manifests, HPA & CronJobs)
  - Sub-task 4: `feat/UTB-19-cdn-backups-data-check` (Nightly Data-Level Integrity Checker)
- **Status:** All Sub-Tasks Completed & Merged into `feat/UTB-19-cdn-backups`
- **Packages & Directories Modified:** `infra/nginx/`, `infra/scripts/`, `infra/k8s/`, `apps/api/`, `packages/contracts/`, `packages/config/`, `packages/db/`, `.env.example`, `package.json`, `README.md`, `CHANGELOG.md`
- **Scope & Deliverables:**
  - **Edge CDN Caching Layer (`infra/nginx/nginx.conf`)**:
    - Configured dedicated edge cache zones `media_cache` (2GB, 24h TTL) and `api_cache` (500MB, microcaching).
    - Added edge caching headers (`X-Cache-Status`, `Cache-Control: public, max-age=86400, stale-while-revalidate=3600`, `ETag`, `If-None-Match`).
    - Implemented microcaching (5s) on high-concurrency public read endpoints (`/api/v1/events`, `/api/v1/venues`) with cache bypass on authentication/cookies.
    - Global security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`.
  - **Signed Object-Storage Media Upload API (`apps/api/src/modules/media/`)**:
    - `POST /api/v1/media/upload-url`: Generates cryptographic pre-signed upload URLs for AWS S3, OCI Object Storage (S3-compatible API), and Local storage simulator.
    - Implemented lightweight AWS SigV4 pre-signing with zero heavy external dependencies, binding `content-type` in `X-Amz-SignedHeaders`.
    - Strict MIME type whitelisting (`image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`, `application/pdf`) and 10MB file size ceiling.
    - `PUT /api/v1/media/upload/:purpose/:filename`: Direct local binary PUT upload receiver with HMAC-SHA256 signature verification, strict MIME type matching, and length-protected constant-time comparison.
    - `GET /api/v1/media/:purpose/:filename`: Public media CDN delivery with MD5 ETag computation, conditional HTTP 304 handling, and origin path rewriting support for `/media/`.
    - Zod schemas in `packages/contracts/src/media.ts` and configuration in `packages/config/src/env.ts`.
  - **Automated Multi-DB Hot Backups & Restore Drill Automation (`infra/scripts/`)**:
    - `backup-all.sh`: Automated multi-database hot backup for PostgreSQL (`pg_dump -Fc`), MongoDB (`mongodump --archive --gzip`), and Redis (`redis-cli bgsave` / RDB snapshot) with SHA256 checksums and JSON manifest output (`manifest_<timestamp>.json`). Prioritizes `POSTGRES_DIRECT_PORT` (5432) to bypass PgBouncer session limitations and requires explicit mock opt-in (`ALLOW_MOCK_BACKUP=true`) to prevent false-positive backups in production.
    - `restore-drill.sh`: Automated Disaster Recovery (DR) restore drill script verifying checksum integrity, executing non-destructive test restores into isolated temporary drill databases, verifying table and document counts, computing Recovery Time Objective (RTO in seconds), and writing structured drill reports.
    - `prune-backups.sh`: Retention cleaner enforcing configurable backup retention policy (default: 7 days) across database dumps, manifests, and drill reports.
    - Verified through automated test suite `packages/config/src/backup-restore.spec.ts`.
  - **Production Kubernetes Manifests (`infra/k8s/`)**:
    - Complete Kubernetes manifest suite: Namespace (`00-namespace.yaml`), ConfigMap (`01-configmap.yaml`), Secrets template (`02-secrets.yaml`), PersistentVolumeClaim (`02-backup-pvc.yaml`), ClusterIP Services (`03-services.yaml`), RollingUpdate Deployments with health probes & resource guardrails (`04-api-deployment.yaml`, `05-realtime-deployment.yaml`, `06-worker-deployment.yaml`, `07-web-deployment.yaml`), Nginx Ingress (`08-ingress.yaml`), and Kustomization (`kustomization.yaml`).
    - Added dedicated Dockerfile for infrastructure automation image (`infra/docker/Dockerfile.infra-tools`).
    - HorizontalPodAutoscalers (`09-hpa.yaml`) for API (2-10 pods) and Realtime (2-8 pods) targeting 70% CPU / 80% Memory utilization.
    - Automated CronJobs (`10-cronjobs.yaml`): Daily Backup (`02:00 UTC`), Nightly Data Checker (`03:00 UTC`), and Weekly DR Drill (`04:00 UTC Sunday`) with persistent storage volume bindings.
    - Verified through automated test suite `packages/config/src/k8s.spec.ts`.
  - **Nightly Data-Level Integrity Checker (`pnpm db:check:data`)**:
    - CLI tool in `packages/db/src/data-check.ts` and wired into root `package.json`.
    - Parameterized table existence queries and protected seat integrity against unseated tickets.
    - Audits operational consistency across 5 critical data categories:
      1. Financial & Ledger: Order totals equal sum of order item prices; rejects negative amounts.
      2. Referential Consistency: Detects orphaned order_items, tickets, and gate_scans.
      3. Seat State & Double-Booking: Prevents duplicate active tickets for the same seat; detects seats marked AVAILABLE with active tickets.
      4. Ticket Lifecycle: Enforces D-2 statuses; verifies CHECKED_IN tickets have gate scans; catches ISSUED tickets with valid scans.
      5. Venue & Event Temporal: Chronological event dates (`startDate <= endDate`) and venue relations.
    - 16 comprehensive unit tests passing in `packages/db/src/data-check.spec.ts`.

---

## [UTB-18] - 2026-11-22

### Production Dockerization & Continuous Deployment Pipeline

- **Ticket Key:** `UTB-18`
- **Completion Date:** 2026-11-22
- **Main Feature Branch:** `feat/UTB-18-docker-cd-pipeline`
  - Sub-task 1: `feat/UTB-18/dockerfiles`
  - Sub-task 2: `feat/UTB-18/docker-compose`
  - Sub-task 3: `feat/UTB-18/cd-workflow`
  - Sub-task 4: `feat/UTB-18/tests`
- **Status:** Merged into `main` & Verified Live (Deployment operational on Oracle Cloud Always Free VM at `129.221.182.252` serving React SPA, NestJS REST API, Socket.io Realtime, BullMQ Worker, and Nginx reverse proxy)
- **Packages & Directories Modified:** `docker/`, `apps/api/`, `apps/realtime/`, `apps/worker/`, `apps/web/`, `infra/docker/`, `infra/nginx/`, `infra/scripts/`, `.github/workflows/`, `packages/config/`, `docs/`, `docs/adr/`, `.dockerignore`, `docker-compose.prod.yml`, `.env.example`, `package.json`, `README.md`, `CHANGELOG.md`
- **Scope & Deliverables:**
  - **Live Production Deployment (`http://129.221.182.252/`)**:
    - Complete full-stack live deployment verified on Oracle Cloud Infrastructure (OCI) Always Free VM (Ubuntu host, 4GB NVMe swap space, Docker Compose).
    - Production edge ingress served via Nginx reverse proxy on ports 80/443:
      - React SPA: `http://129.221.182.252/` (HTTP 200 OK)
      - System Health Check: `http://129.221.182.252/health` (HTTP 200 OK)
      - REST API Microservice: `http://129.221.182.252/api/v1/health` (HTTP 200 OK)
      - Socket.io Realtime Gateway: `ws://129.221.182.252/socket.io/` (HTTP 200 OK handshake)
      - Nginx Proxy Health: `http://129.221.182.252/healthz` (HTTP 200 OK)
  - **Frontend Containerization (`apps/web/Dockerfile` & `infra/docker/Dockerfile.web`)**:
    - Vite + Tailwind React SPA compiled in multi-stage Docker build and served via lightweight Nginx Alpine container.
    - Configured client-side SPA fallback routing (`try_files $uri $uri/ /index.html;`).
    - Wired into `docker-compose.prod.yml` as `web` service on internal port 80.
  - **Production Secrets & Environment Hardening**:
    - Added automated production secret generation (`openssl rand -hex 32`) in `.github/workflows/cd.yml` to replace development placeholders for `MASTER_TICKET_SECRET`.
    - Mapped `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `MASTER_TICKET_SECRET` to all microservices (`api`, `realtime`, `worker`), preventing Zod refine validation startup failures.
  - **Root `.dockerignore`**: Created comprehensive Docker ignore file excluding `node_modules`, `dist`, `.git`, `.turbo`, `.env*`, `coverage`, `docs`, and frontend build artifacts (`apps/web/dist`) while preserving source code for container compilation.
  - **Multi-Stage Backend Dockerfiles (`docker/*.Dockerfile`, `apps/*/Dockerfile`, `infra/docker/*`)**:
    - Standardized 4-stage multi-stage Docker builds across all three backend microservices (`deps`, `build`, `prod-deps`, `production`).
    - Runs as non-root `USER node` with process signal handling via `tini`, container health check with busybox `wget -q --spider`, and stripped `devDependencies`.
  - **Production Docker Compose Stack (`docker-compose.prod.yml`)**:
    - Defines standalone production orchestration for `api`, `realtime`, `worker`, `web`, and `nginx`.
    - Wires infrastructure services (`postgres`, `pgbouncer:latest`, `mongo`, `redis`, `elasticsearch`) with healthcheck-based `depends_on`.
  - **Automated CD Pipeline (`.github/workflows/cd.yml`)**:
    - Hardened SSH deployment against non-interactive shell unbound variables, git working tree dirty conflicts, and `appleboy/ssh-action` line-splitting bugs.
    - Automated failure diagnostics dumping container status and service logs on startup errors.
  - **Documentation & Verification Suite**:
    - Authored and updated documentation in `README.md`, `apps/README.md`, `apps/web/README.md`, `infra/README.md`, `infra/docker/README.md`, `packages/config/README.md`, and `docs/deployment.md`.
    - Passed all 22 tests in `@urticketbuddy/config` validation suite.

---

## [UTB-15] - 2026-11-21

### Capped P2P Resale Marketplace API

- **Ticket Key:** `UTB-15`
- **Completion Date:** 2026-11-21 (Audit & Remediation completed 2026-11-24)
- **Main Feature Branch:** `feat/UTB-15-resale-marketplace`
  - Sub-task 1: `feat/UTB-15-resale-marketplace-contracts-db`
  - Sub-task 2: `feat/UTB-15-resale-marketplace-api`
  - Sub-task 3: `feat/UTB-15-resale-marketplace-tests`
  - Sub-task 4: `feat/UTB-15-resale-marketplace-audit-remediation`
- **Status:** Completed & Audited (All sub-tasks merged into `feat/UTB-15-resale-marketplace`; PR ready for review; `main` unmerged)
- **Packages & Directories Modified:** `packages/contracts`, `packages/db`, `apps/api`, `apps/tester`, `README.md`, `CHANGELOG.md`, `.engram`
- **Scope & Deliverables:**
  - **Contracts & 110% Price Cap (`packages/contracts/src/resale.ts`)**:
    - Implemented `maxResalePrice(faceValueMinor)` (`Math.floor((faceValueMinor * 110) / 100)`), `ResaleListingStatus`, `LedgerEntryKind`, `CreateResaleListingSchema`, `UpdateResaleListingSchema`, `PurchaseResaleListingSchema`, and `ErrorCode.RESALE_PRICE_CAP_EXCEEDED`.
    - Added boundary and 32-bit limit unit tests in `packages/contracts/src/index.spec.ts`.
    - Recompiled package build artifacts (`dist/`) ensuring runtime availability across workspace packages.
  - **Database Entities & Migration (`packages/db`)**:
    - Added `ResaleListing` (`resale_listings`) and `LedgerEntry` (`ledger_entries`) TypeORM entities with covering indexes (`idx_resale_listings_ticket_id`, `uq_resale_listings_active_ticket`, `idx_resale_listings_event_id`, `idx_resale_listings_seller_id`, `idx_ledger_entries_listing_id`).
    - Created reversible migration `1795136850000-UTB-15-init-resale-ledger.ts` with exact TypeORM hashed FK constraint names (`FK_6f3aa262c5f7947d2adb51d3f36`, `FK_23c4922b768155c827d32122952`, `FK_06ca5804051219422c87e507899`) and `ON DELETE RESTRICT` on `ledger_entries`.
    - Passed all 4 database consistency checks (`pnpm db:check`).
  - **Resale Module (`apps/api/src/modules/resale`)**:
    - Added `PlatformSettingsPort` (`PLATFORM_SETTINGS_PORT`) + `DefaultPlatformSettingsProvider` (10% / `1000` bps).
    - Implemented `POST /api/v1/resale/listings`, `PATCH /api/v1/resale/listings/:listingId`, `GET /api/v1/resale/listings` (`@Public()`), and `POST /api/v1/resale/listings/:listingId/purchase` (`Idempotency-Key` deduplication, Redis `resale_lock:<listingId>`, `PaymentProvider` charge + compensating refund, PostgreSQL `SELECT ... FOR UPDATE` transaction, 2-row ledger split, `ticket.ownerId` transfer, `ticket.seedVersion += 1`, and `ticket.transferred` event).
    - Hardened `ResaleService.updateListing` with relation loading fallbacks to prevent undefined entity property access.
  - **Tester App Integration (`apps/tester`)**:
    - Integrated the complete **Capped P2P Resale Marketplace** endpoint suite into the `@urticketbuddy/tester` workbench catalog (`POST /listings`, `PATCH /listings/:id`, `GET /listings`, `POST /listings/:id/purchase`).
    - Verified clean production build (`pnpm --filter @urticketbuddy/tester build`).
  - **Testing & Documentation**:
    - Added comprehensive unit tests in `packages/contracts/src/index.spec.ts` (10/10 passing) and `apps/api/src/modules/resale/resale.service.spec.ts` (18/18 passing).
    - Added 8-scenario Supertest E2E integration suite in `apps/api/test/resale.e2e-spec.ts` (8/8 passing) covering cap enforcement, non-ISSUED/duplicate rejections, price lowering/withdrawal, pagination, eventId filtering, payment failure lock release, idempotency caching, and gate scanner token invalidation.
    - Authored dedicated technical specification in `apps/api/src/modules/resale/README.md` and updated root `README.md`, `apps/tester/README.md`, and `CHANGELOG.md`.

---

## [UTB-14] - 2026-11-20

### Dynamic QR Tickets, RedisBloom Prefilter, Ticket Wallet, & Gate Scanner API

- **Ticket Key:** `UTB-14`
- **Completion Date:** 2026-11-20
- **Main Feature Branch:** `feat/UTB-14-dynamic-qr-gate`
  - Sub-task 1: `feat/UTB-14-dynamic-qr-gate-db-entities`
  - Sub-task 2: `feat/UTB-14-dynamic-qr-gate-tickets-module`
  - Sub-task 3: `feat/UTB-14-dynamic-qr-gate-scanner-bloom`
  - Sub-task 4: `feat/UTB-14-dynamic-qr-gate-tests`
  - Sub-task 5: `feat/UTB-14-dynamic-qr-gate-security-hardening`
  - Sub-task 6: `feat/UTB-14-dynamic-qr-gate-audit-fixes`
- **Status:** Completed (Sub-tasks merged into `feat/UTB-14-dynamic-qr-gate`; PR ready for review; `main` unmerged)
- **Packages & Directories Modified:** `packages/contracts`, `packages/db`, `apps/api`, `README.md`, `CHANGELOG.md`
- **Scope & Deliverables:**
  - **TypeORM Entities & PostgreSQL Migration (`packages/db`)**:
    - Created `Ticket` entity: `id` (uuid PK), `eventId` (uuid FK with covering index `idx_tickets_event_id`), `eventSeatId` (uuid FK with covering index `idx_tickets_event_seat_id`), `orderId` (uuid FK with covering index `idx_tickets_order_id`), `ownerId` (varchar indexed with `idx_tickets_owner_id`), `status` (`ISSUED`, `CHECKED_IN`, `VOID`, `REVOKED`), `seedVersion` (int default 1), `faceValueMinor` (int default 100000).
    - Created `GateScan` entity: `id` (uuid PK), `ticketId` (uuid FK nullable with `ON DELETE SET NULL`, covering index `idx_gate_scans_ticket_id`), `scannedTicketRef` (varchar nullable storing raw scanned token id without FK violations), `eventId` (uuid FK with covering index `idx_gate_scans_event_id`), `scannedBy` (varchar), `result` (`VALID`, `USED`, `INVALID`, `EXPIRED`, `WRONG_EVENT`), `scannedAt` (timestamptz), and composite index `idx_gate_scans_event_scanned_at` on `(eventId, scannedAt)`.
    - Added reversible TypeORM migration `1795036850000-UTB-14-init-tickets-gate-scans.ts` with hashed foreign keys (`FK_8a101375d173c39a7c1d02c9d7d`, `FK_265db83fa22115be54165ab4c24`, `FK_e3e1e1e9d4ee34649da54a016e4`, `FK_594f94930d041a64fef309e6252`, `FK_eb2d496837fe287e6d5218e5fe3`) guaranteeing zero schema drift on `pnpm db:check`.
    - Integrated ticket creation into `OrdersService.checkout()` inside the ACID TypeORM transaction and registered issued tickets into `BloomService`.
  - **Contracts & Shared Types (`packages/contracts`)**:
    - Added `ScanResult` enum, `DynamicQrResponseSchema`, `GateScanRequestSchema`, `GateScanResponseSchema`, `TicketResponseSchema`, `TicketListResponseSchema`, and `GateMetricsResponseSchema`.
    - Added ticket error codes: `TICKET_NOT_FOUND`, `TICKET_ALREADY_USED`, `TICKET_EXPIRED`, `TICKET_INVALID`, `TICKET_FORGED`, `WRONG_EVENT`.
  - **Cryptographic Dynamic QR Engine (`apps/api/src/modules/tickets`) (Decision D-3)**:
    - 30-second time-decaying windows: `window = Math.floor(Date.now() / 1000 / 30)`.
    - HKDF-SHA256 key derivation: `HKDF(MASTER_TICKET_SECRET, salt=0, info="${ticketId}:${seedVersion}", len=32)`.
    - HMAC-SHA256 computation: `HMAC(derivedKey, "${ticketId}:${window}").digest("base64url")`.
    - Token payload: `base64url("${ticketId}.${window}.${hmac}")`.
    - Constant-time verification using `crypto.timingSafeEqual` with 1-window clock skew tolerance `[currentWindow - 1, currentWindow]`.
    - Endpoints:
      - `GET /api/v1/tickets/:ticketId/dynamic-qr`: Verifies caller ownership or admin, verifies `ISSUED` status, and generates rotating payload.
      - `PATCH /api/v1/tickets/:ticketId/rotate-key`: Protected by `@Roles(UserRole.ADMIN)`, increments `seedVersion` by 1, instantly invalidating previously issued tokens.
      - `GET /api/v1/users/me/tickets` & `GET /api/v1/tickets/me`: Returns user wallet tickets.
  - **RedisBloom Prefilter Service (`apps/api/src/common/bloom`)**:
    - High-throughput prefilter `BloomService` utilizing Redis key `bf:tickets`.
    - Graceful fallback to Redis SET (`bf:tickets:fallback`) and in-memory Set when RedisBloom commands are absent in local or mock environments.
    - Automatic filter warming from PostgreSQL on module bootstrap (`onApplicationBootstrap`).
    - Prefilter invariant: Rejects definite non-existent/forged tickets with $O(1)$ operations with zero PostgreSQL queries executed.
  - **Gate Scanner Module & Replay Protection (`apps/api/src/modules/gate`)**:
    - `POST /api/v1/gate/scan`: Protected for `GATE_STAFF`, `ORGANIZER`, `ADMIN`.
      1. Base64url payload decode.
      2. RedisBloom prefilter validation (immediate 400 rejection for forged IDs without querying PostgreSQL).
      3. PostgreSQL lookup and event ID match verification.
      4. Constant-time HMAC & window expiration verification (returns 400 EXPIRED if old screenshot).
      5. Redis replay protection (`qr_nonce:${ticketId}:${window} = SET NX EX 60`). Returns 409 Conflict if duplicate scan attempt detected.
      6. Atomic conditional database update (`UPDATE tickets SET status = 'CHECKED_IN' WHERE id = :ticketId AND status = 'ISSUED'`).
      7. Audit log insertion (`GateScan` -> `VALID`) and returns `200 OK`.
    - `GET /api/v1/gate/metrics`: Real-time entry velocity, total scans, valid check-ins, and rejections.
  - **Testing & Verification**:
    - Unit tests for `TicketsService` (10/10 passed) and `GateService` (15/15 passed).
    - Supertest E2E integration test suite (`apps/api/test/tickets-gate.e2e-spec.ts`) asserting dynamic QR generation, 403 authorization guards, successful check-ins, replay rejection, expired window screenshot rejection, seed rotation invalidation, and Bloom filter zero-PostgreSQL rejection (12/12 passed).
    - Quality gates passed: `pnpm db:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm graphify`.
  - **Security & Concurrency Hardening (Sub-task 5)**:
    - Fixed forged token audit logging to record `ticketId: null` and `scannedTicketRef` preventing PostgreSQL Foreign Key constraint crashes.
    - Updated `gate_scans.ticketId` FK to `ON DELETE SET NULL` preventing turnstile audit logs from being wiped if a ticket record is removed.
    - Implemented chunked (`take: 2000`) and pipelined RedisBloom warming to prevent node heap exhaustion during startup.
    - Added strict window constraint `[currentWindow - 1, currentWindow]` per Decision D-3, rejecting future windows.
    - Added atomic SQL increment for `seedVersion` in `TicketsService.rotateKey` avoiding race condition overwrites.
    - Enforced organizer tenant isolation on gate scan and metrics endpoints.
    - Added explicit status differentiation (`CHECKED_IN`, `REVOKED`, `VOID`).
    - Added Redis replay nonce rollback on unexpected transient database errors so patrons are not locked out for 60s on transient DB network glitches.
    - Scoped entry velocity calculation strictly to valid scans in the trailing 5-minute sliding window.
  - **Adversarial Security & Architecture Audit Fixes (Sub-task 6)**:
    - Implemented distributed per-ticket turnstile scan lock (`scan_lock:${ticketId}`, TTL 5s) in Redis to eliminate race conditions between adjacent 30-second windows across concurrent turnstiles.
    - Added atomic `seedVersion: ticket.seedVersion` guard in `ticketRepository.update` to detect concurrent key rotation and reject revoked tokens with 400 Bad Request (`TICKET_INVALID`).
    - Implemented Redis key existence check and fail-open mechanism in `BloomService` to ensure cold starts, Redis flushes, or network partitions never falsely reject legitimate paying attendees.
    - Added strict UUID validation via NestJS `ParseUUIDPipe` on `:ticketId` route parameters and `eventId` query parameters.
    - Enforced safe string truncation (`substring(0, 255)`) on `scannedTicketRef` to prevent PostgreSQL VARCHAR(255) overflow errors on oversized attack payloads.
    - Added Zod refinement in `packages/config` forbidding the default development `MASTER_TICKET_SECRET` when `NODE_ENV === "production"`.
    - Hardened organizer tenant isolation in `GateService` to fail closed for organizer roles when event ownership cannot be verified.
    - Corrected concurrent check-in error message to `"Ticket is no longer in ISSUED state (already checked in)"`.

---

## [UTB-11] - 2026-11-20

### Background Hold Expiry Worker & Auto-Release Engine

- **Ticket Key:** `UTB-11`
- **Completion Date:** 2026-11-20
- **Main Feature Branch:** `feat/UTB-11-hold-expiry-worker`
  - Sub-task 1: `feat/UTB-11/worker-scaffold`
  - Sub-task 2: `feat/UTB-11/expiry-cron`
  - Sub-task 3: `feat/UTB-11/tests`
- **Status:** Completed (Sub-tasks merged into `feat/UTB-11-hold-expiry-worker`; PR ready for review; `main` unmerged)
- **Packages & Directories Modified:** `apps/worker`, `README.md`, `CHANGELOG.md`, `pnpm-lock.yaml`, `.engram`
- **Scope & Deliverables:**
  - **Worker App Initialization (`apps/worker`)**:
    - Installed `@nestjs/schedule` and wired `ScheduleModule.forRoot()` in `AppModule`.
    - Added `WorkerInfraModule` (`apps/worker/src/infrastructure/worker-infra.module.ts`) providing `WORKER_REDIS_CLIENT` (`ioredis`), `WORKER_REDIS_SCRIPTS` (`RedisScriptsWrapper`), and optional `WORKER_DATA_SOURCE` (`AppDataSource` with graceful fallback when Postgres is unavailable).
  - **Expiry Cron Service (`apps/worker/src/modules/expiry`)**:
    - Implemented `ExpiryService` with `@Cron("*/5 * * * * *")` and an `isRunning` overlap guard.
    - Scans Redis (`SCAN` on `hold_expiry:{*}`) to discover active event IDs, invokes `RedisScriptsWrapper.expireDue(eventId, nowMs)` (`expire_due.lua`), publishes `{ eventId, seatIds, state: "AVAILABLE", source: "WORKER_EXPIRY" }` to Redis Pub/Sub channel `seat-updates:{eventId}`, and optionally syncs PostgreSQL `event_seats` (`status = 'HELD'` -> `'AVAILABLE'`).
  - **Testing & Documentation**:
    - Added unit tests (`apps/worker/test/expiry.service.spec.ts`) covering empty scans, multi-cursor deduplication, Pub/Sub emission, per-event error isolation, and optional Postgres sync.
    - Added Testcontainers Redis integration test (`apps/worker/test/expiry.integration.spec.ts`) verifying `expire_due.lua` lock cleanup and Redis Pub/Sub broadcast.
    - Updated `apps/worker/README.md`, root `README.md`, and `CHANGELOG.md`.

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

## [UTB-3] - 2026-11-18

### JWT Authentication, Password Hashing, RBAC, and Token Rotation Module

- **Ticket Key:** `UTB-3`
- **Completion Date:** 2026-11-18
- **Main Feature Branch:** `feat/UTB-3-jwt-auth-rbac`
  - Sub-task 1: `feat/UTB-3-jwt-auth-rbac-db-user-entity`
  - Sub-task 2: `feat/UTB-3-jwt-auth-rbac-auth-module`
  - Sub-task 3: `feat/UTB-3-jwt-auth-rbac-tests`
- **Status:** Completed & Audited (Security & identity audit issues resolved; PR ready for review; `main` unmerged)
- **Packages & Directories Modified:** `packages/db`, `packages/contracts`, `apps/api`, `README.md`, `CHANGELOG.md`, `.engram`
- **Scope & Deliverables:**
  - **TypeORM Entities & Migrations (`packages/db`)**:
    - Implemented `User` entity: `id` (uuid PK), `email` (varchar unique), `passwordHash` (varchar), `firstName` (varchar), `lastName` (varchar), `role` (varchar: `CUSTOMER`, `ORGANIZER`, `ADMIN`, `GATE_STAFF`, default `CUSTOMER`), `organizerTenantId` (uuid nullable, indexed with `idx_users_organizer_tenant_id`), `createdAt`, `updatedAt`.
    - Implemented `RefreshToken` entity: `id` (uuid PK), `userId` (uuid FK with covering index `idx_refresh_tokens_user_id`), `tokenHash` (varchar unique with index `idx_refresh_tokens_token_hash`), `familyId` (uuid with index `idx_refresh_tokens_family_id`), `isRevoked` (boolean default false), `expiresAt` (timestamptz), `createdAt`, `updatedAt`.
    - Added reversible migrations `1794837000000-UTB-3-init-users.ts` and `1794837100000-UTB-3-init-refresh-tokens.ts`, validated via `pnpm db:check`.
  - **Contracts & Validation (`packages/contracts`)**:
    - Created `RegisterRequestSchema`, `LoginRequestSchema`, `AuthUserSchema`, `AuthResponseSchema`, `CreateGateStaffRequestSchema`, and `UpdateProfileRequestSchema`.
    - Added `GATE_STAFF` to `UserRole` enum.
    - Added `EMAIL_ALREADY_EXISTS`, `INVALID_CREDENTIALS`, `INVALID_REFRESH_TOKEN`, `TOO_MANY_REQUESTS` to `ErrorCode`.
  - **NestJS Auth Module & Security (`apps/api/src/modules/auth` & `apps/api/src/modules/users`)**:
    - `POST /api/v1/auth/register`: Hashes passwords with `bcrypt` (10 rounds), checks email uniqueness (409 Conflict on duplicate), stores user in PostgreSQL, returns user object with short-lived JWT `accessToken` (15m) and sets `httpOnly`, `Secure`, `SameSite: strict` refresh token cookie.
    - `POST /api/v1/auth/login`: Authenticates credentials using `bcrypt.compare`, rate-limited via `@Throttle({ default: { limit: 5, ttl: 60000 } })`, returns JWT access token and sets secure refresh token cookie.
    - `POST /api/v1/auth/refresh`: Implements cryptographic token rotation with family reuse detection (`jti: crypto.randomUUID()`). Replaying an already-revoked refresh token revokes all active tokens in that user's token family.
    - `POST /api/v1/auth/logout`: Revokes refresh token in database and clears the refresh cookie.
    - `POST /api/v1/organizer/gate-staff`: Allows organizers or admins to provision scanner accounts bound to their `organizerTenantId`.
    - `GET` & `PUT /api/v1/users/me/profile`: Authenticated user profile retrieval and update endpoints.
    - `GoogleStrategy`: Passport Google OAuth 2.0 integration linked securely by verified email with automatic account creation/lookup.
    - `JwtStrategy` & `JwtAuthGuard`: Passport-based strategy extracting Bearer token and verifying against `JWT_SECRET`. Supports `@Public()` decorator to bypass authentication.
    - `RolesGuard` & `@Roles(...)`: Enforces RBAC permissions (`CUSTOMER`, `ORGANIZER`, `ADMIN`, `GATE_STAFF`), returning 403 Forbidden on role mismatch.
    - `OwnershipGuard`: Tenant and resource ownership protection for organizer resources.
    - Parameter decorator `@CurrentUser()` for accessing authenticated user payload.
  - **Testing & Quality Verification**:
    - Comprehensive unit tests for `AuthService` and `AuthController` (18/18 passing).
    - Supertest E2E integration suite (`apps/api/test/auth.e2e-spec.ts`, 12/12 passing) validating registration, login, bad credential rejections, duplicate conflict rejections, token rotation, family reuse detection, gate staff provisioning, profile updates, and RBAC matrix.
    - Quality gates passed: `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm test`, `pnpm db:check` (4/4 passed), and `pnpm graphify`.

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
