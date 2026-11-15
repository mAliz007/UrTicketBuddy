# AGENTS.md
UrTicketBuddy

## 1. Project
High-concurrency event ticketing platform: parametric venue builder (Konva), Redis + Lua seat locks, time-decaying dynamic QR tickets, capped P2P resale. Requirements live in the project proposal (docs/proposal). Read your Jira ticket first. If this file and a ticket disagree, stop and ask the team; do not guess.

## 2. Frozen decisions (change only through an ADR in docs/adr)
D-1 Backend is NestJS + TypeScript. Frontend is React + Vite + Tailwind (no Next.js).
D-2 Ticket status: ISSUED -> CHECKED_IN, plus VOID and REVOKED.
D-3 QR token is HMAC-SHA256 over ticketId + 30-second window. Key = HKDF (MASTER_TICKET_SECRET, ticketId + seed_version). Rotating = increment seed_version.
D-4 Payments go through the PaymentProvider interface (Stripe test mode, Safepay, FakeProvider).
D-5 Live deploy on Railway; Kubernetes manifests validated on kind; AWS optional.
D-6 Three backend services only: api (modular monolith), realtime (Socket.io), worker (BullMQ).
D-7 Libraries: TypeORM (Postgres), Mongoose (MongoDB), ioredis, BullMQ, zod, Jest + Supertest + Testcontainers, k6, Vitest + Playwright on the web, pnpm + Turborepo.
Money is always integer minor units. Time is UTC. IDs are UUIDs except seat IDs (<sectionId>-<row>-<number>).

## 3. Repo layout and ownership (CODEOWNERS mirrors this)
apps/web React SPA: src/features/<feature>, src/components/ui, src/lib
apps/api NestJS core API: src/modules/<module>, src/common (ports, zod schemas, DTO types, enums, error codes, guards)
apps/realtime Socket.io gateway (Redis adapter)
apps/worker BullMQ processors
packages/contracts socket payloads
packages/venue-engine pure TS parametric layout math (no DOM)
packages/redis-scripts Lua scripts + typed wrappers
packages/db TypeORM data source, entities, migrations
packages/config tsconfig, eslint, prettier, env loader
infra/ docker, nginx, k8s, loadtests, scripts
docs/ adr, runbooks, reports

Member A owns: infra/, .github/, packages/config, packages/db tooling, api modules auth, users, admin, analytics, search, web features auth, admin, search.
Member B owns: apps/web shell and features marketing, events, seat-map, organizer-builder; packages/venue-engine; api modules venues, events.
Member C owns: packages/redis-scripts, apps/realtime, apps/worker, api modules seats, checkout, tickets, gate, resale; web features checkout, wallet, gate, resale infra/loadtests.

Never edit another owner's directory without asking in the PR. Trivial fixes are allowed with the owner as reviewer.
Apps never import from each other. Share code only through packages/*.

## 4. Commands
pnpm i | pnpm dev | docker compose up -d (add --profile scale for 2 realtime replicas)
pnpm graphify | pnpm lint | typecheck | test | build (all run through Turborepo)
pnpm db:migrate | db: revert | db: generate | db:check
pnpm search: reindex | k6 run infra/loadtests/<scenario>.js
Ports: web 5173, api 3000, realtime 3001, worker 3002, nginx 80, postgres 5432, pgbouncer 6432, mongo 27017, redis 6379, elasticsearch 9200, pgadmin 5050. Apps connect to Postgres through PgBouncer (6432).

## 5. Git workflow
One ticket = one main feature branch. Branch format: <type>/UTB-<n>-<slug> (feat, fix, chore, ci, docs, test).
**Sub-tasking:** For large tickets, break the main feature branch into sub-tasks. Branch these sub-tasks off the main feature branch using the format: `<type>/UTB-<n>-<slug>/<sub-task>` (e.g., `feat/UTB-5-seat-lock/lua-scripts`). Merge sub-tasks back into the main feature branch before opening the final PR to `main`.
Never push to main. Squash merge. Rebase on main at least once a day and before opening a PR.
Keep PRs under about 400 changed lines where possible. Split the rest.
Another member reviews every PR. Do not merge with failing CI.
If your ticket needs a contract change, open a small contract-only PR first and merge it before the feature PR.

## 6. Code and API conventions
REST under /api/v1. Validate every input with zod schemas from packages/contracts. Reject unknown fields.
Error envelope for every failure: { error: { code, message, details?, requestId } }. Error codes are an enum in packages/contracts.
Pagination: ?page=&pageSize= (max 100) returning { items, page, pageSize, total }.
POST endpoints that move money or create orders require an Idempotency-Key header.
Every route is protected by default. Use @Public() to opt out and @Roles(...) to restrict. Tenant-owned resources use OwnershipGuard.
Controllers are thin; logic lives in services. Modules talk to each other through exported services or the ports in apps/api/src/common/ports, never by reaching into another module's files.
No any, no ts-ignore without a comment and a ticket key. No console.log; use the Nest logger with request ids. Never log tokens, passwords or QR payloads.
Config comes only from the zod env schema in packages/config. Add every new variable to .env.example. No secrets in git.

## 7. Registry: Redis keys, queues, events, ports
Change an entry only through a contract PR.
seat_lock: {<eventId>}:<seatId> = userId, TTL 600
seat_sold: {<eventId>} = SET of seatIds
hold_expiry: {<eventId>} = ZSET (score = expiry ms, member = seatId)
user_holds: {<eventId>}:<userId> = SET of seatIds
bf: tickets = RedisBloom filter of ticket ids (prefilter only; never used to approve a scan)
qr_nonce:<ticketId>:<window> = SET NX EX 60
resale_lock: <listingId> = buyer id, TTL 300
rate: <route>: <key> = throttler counters
Redis pub/sub channel: seat.state (payload SeatStateEvent)
Socket.io: server emits seat: state to room event: {eventId}; client emits room: join and room: leave with { eventId }
BullMQ queues: hold-expiry, search-index, order-notifications, ticket-seed-rotation. Job payload types live in packages/contracts.
In-process domain events: ticket.issued, ticket.transferred
Ports (apps/api/src/common/ports): EventSeatCatalogPort (implemented by B), PlatformSettingsPort (implemented by A), PaymentProvider (implemented by C)
Seat state colors: AVAILABLE green, HELD yellow, SOLD red, DISABLED grey

## 8. Databases and migrations
Postgres is the source of truth for money, orders, tickets and users. MongoDB stores venue layouts only. Redis holds transient seat state only. Elasticsearch is a read model.
Table owners: A users, refresh_tokens, platform_settings, audit_logs. B venues, events, ticket_tiers, event_seats. C orders, order_items, payments, payment_events, tickets, gate_scans, resale_listings, ledger_entries.
Never touch Postgres during seat selection only checkout finalization writes tickets.
Migrations: file name <timestamp>-UTB-<n>-<description>. Forward and revert must both work. Never edit a merged migration; add a new one. Never use synchronize. Each ticket adds its own migration files and never reorders existing ones.
Every table has a primary key every foreign key column has an index; audit_logs is append-only.

## 9. Definition of Done (every ticket)
All acceptance criteria met and demonstrated in the PR description (commands run, screenshots for UI).
Lint, typecheck, unit and integration tests pass in CI; new logic has tests. Money, locking and auth code needs tests for failure paths.
Migrations apply and revert cleanly; db:check passes.
Workspace architecture is mapped and updated (pnpm graphify runs cleanly).
No new dependency without a one-line justification in the PR.
**A proper README is created/updated for the specific task/module, relevant parent READMEs are updated, and the global root README is maintained.** API changes reflected in contracts.
No TODO without a ticket key. No dead code, no commented-out blocks.
Another member has reviewed and approved.

## 10. Shared files: avoid conflicts
Additive-only edits in packages/contracts/src/index.ts (add your own file and one export line), docker-compose.yml, infra/nginx and root package.json.
pnpm-lock.yaml conflicts: take main's version and run pnpm i again; never hand-edit.
New routes in apps/web are added in your own feature folder and registered with one line in the route table.
If your task requires a change in a file you do not own, make the smallest possible change in its own commit and name the owner in the PR.

## 11. Rules for AI agents (Google Antigravity IDE)
1. Read this file and the Jira ticket before writing code. Do only what the ticket says do not refactor unrelated code or add features.
2. When given a main feature prompt, break the prompt down into logical sub-tasks. Create and work on sub-branches (e.g., `feat/UTB-1-scaffold/monorepo-setup`) before merging them back to the main feature branch.
3. Work only on the branch named in the ticket/sub-task. Never commit to main, rewrite shared history or force-push someone else's branch.
4. Do not change contracts, key names, queue names, ports or frozen decisions without a contract PR approved by the team.
5. Stay inside your owned directories. If you are blocked by another member's unfinished work, code against the port or mock named in the ticket and say so in the PR.
6. Write tests first for locking, money, authorization and parsing logic.
7. Run lint, typecheck, tests, and `pnpm graphify` before declaring a task done, and paste the results. Regularly run graphify when adding new modules or packages to visualize architecture changes.
8. Never invent credentials or API keys; use environment variables and .env.example.
9. **Always document your work.** Create a proper README for every task or module you work on, update the relevant parent READMEs to link to it, and maintain the global README in the root directory to accurately reflect the workspace's current state.
10. If a requirement is ambiguous or two documents disagree, stop and ask instead of choosing silently.
11. Finish with a short summary: what changed, how to run it, what is left, and any decision the team must confirm.

## 12. PR, Commit, and Database Documentation Standards
**Commit Messages:**
Use Conventional Commits with the ticket key at the end. 
Format: `<type>(<scope>): <description> [UTB-<n>]`
Example: `feat(seats): add atomic hold script [UTB-5]`

**PR Titles:**
Format: `<type>: [UTB-<n>] <Ticket Summary>`
Example: `feat: [UTB-13] Checkout, orders and payment webhooks`

**PR Descriptions:**
Every PR description must be highly detailed and include the following:
* **Summary of Changes:** What features, fixes, or configurations were implemented.
* **Database & Migration Audit (Mandatory):** Explicitly list **all** database changes. You must document exactly what migrations were run and detail the schema changes by going through the new migration files line-by-line. 
* **Seed Data:** Clearly list what database seeds were added, updated, or modified during the ticket.
* **Proof of Work:** Paste command outputs for linting, testing, and building. Include `pnpm graphify` visual output, and UI screenshots/videos where applicable.
* **README Updates:** Confirm that relevant task and root READMEs were updated.