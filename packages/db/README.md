# @urticketbuddy/db

Postgres database configuration, TypeORM DataSource, entity models, and migration tooling for the UrTicketBuddy platform.

---

## 1. Overview

`@urticketbuddy/db` provides the single source of truth for TypeORM entity schemas, transactional database migrations, and structural database consistency checks. Applications across the monorepo connect to PostgreSQL through **PgBouncer (port 6432)** in transaction pooling mode.

### Frozen Architectural Decisions (AGENTS.md)

- **D-1 / D-7**: TypeORM with PostgreSQL is the authoritative system of record for accounts, orders, tickets, and payments.
- **D-8**: Synchronize is **strictly disabled** in all environments (`synchronize: false`). All schema mutations must occur through migrations.
- IDs are UUIDs (generated via `pgcrypto` or `uuid-ossp`).

---

## 2. Migration Scripts & Tooling

Run scripts from the workspace root or directly within `packages/db`:

```bash
# Run all pending forward migrations
pnpm db:migrate

# Revert the latest applied migration
pnpm db:revert

# Generate a new migration diff against entities
pnpm db:generate src/migrations/UTB-<n>-<description>

# Run consistency checks (PK, unindexed FK, synchronize flag, Mongoose indexes)
pnpm db:check

# Run nightly data-level integrity checks (ledger mismatch, orphans, double booking, status audits)
pnpm db:check:data
```

### Nightly Data-Level Integrity Checker (`pnpm db:check:data`)

Audits operational data consistency across tables:

1. **Financial & Ledger Integrity**: Ensures `totalAmount` equals the sum of `order_items.price` and rejects any negative currency values.
2. **Referential & Orphan Audits**: Discovers orphaned `order_items`, `tickets`, and `gate_scans`.
3. **Seat State & Double-Booking Protection**: Prevents multiple active tickets (`ISSUED` or `CHECKED_IN`) for the same seat, and catches seats marked `AVAILABLE` that possess active tickets.
4. **Ticket Lifecycle Audits**: Enforces valid ticket status values (per D-2) and ensures `CHECKED_IN` tickets have corresponding valid gate scan audit entries.
5. **Venue & Event Temporal Consistency**: Verifies venue references and ensures chronological event dates (`startDate <= endDate`).

---

## 3. Migration Naming Standard

All migration filenames must strictly follow the format:

```text
<timestamp>-UTB-<n>-<description>.ts
```

- `<timestamp>`: Unix epoch timestamp in milliseconds (e.g., `1794836828550`).
- `<n>`: Jira ticket number (e.g., `UTB-2`).
- `<description>`: Kebab-case description (e.g., `init-extensions`).

Example:
`packages/db/src/migrations/1794836828550-UTB-2-init-extensions.ts`

### Baseline & Domain Migrations

- `1794836828550-UTB-2-init-extensions.ts`: Baseline migration enabling `pgcrypto` and `uuid-ossp`.
- `1794836850000-UTB-9-init-venues-events.ts`: Venues, Events, and EventSeats tables with foreign keys and covering indexes.
- `1794837000000-UTB-3-init-users.ts`: Users table with unique email index, hashed passwords, and RBAC roles.
- `1794837100000-UTB-3-init-refresh-tokens.ts`: Refresh token families with family revocation and token reuse detection.
- `1794936850000-UTB-10-init-orders.ts`: Orders and OrderItems tables with foreign keys, covering indexes, and monetary precision.
- `1795036850000-UTB-14-init-tickets-gate-scans.ts`: Tickets and GateScans tables with foreign keys, covering indexes, and status tracking.
- `1795136850000-UTB-15-init-resale-ledger.ts`: Capped P2P resale listings (`resale_listings`) and split platform accounting entries (`ledger_entries`).
- `1795136850000-UTB-16-init-admin-audit.ts`: Platform settings table (`platform_settings`), append-only audit trail (`audit_logs`) secured with PostgreSQL trigger `trg_audit_logs_immutable`, and `organizerId` column on `events`.
- `1795236850000-UTB-17-add-ticket-unique-seat-idx.ts`: Partial unique index `uq_active_ticket_seat` on `tickets ("eventId", "eventSeatId") WHERE status IN ('ISSUED', 'CHECKED_IN')` mathematically eliminating double-booking at the relational engine level.
- `1795336850000-UTB-23-f4-f6-tiers-venue-owner-audit-role.ts`: Creates `ticket_tiers` table with covering FK index `idx_ticket_tiers_event_id`, adds `organizerId` + `idx_venues_organizer_id` to `venues`, and provisions restricted `SELECT, INSERT`-only database role `utb_app_audit_role` on `audit_logs`.

### Entities

- `Venue`: Physical venue metadata, tenant owner (`organizerId`), and reference to versioned MongoDB layout document (`layoutMongoId`).
- `Event`: Event instance belonging to a venue (`venueId` FK, optional `organizerId` tenant identifier).
- `EventSeat`: Individual seat coordinate and tier record belonging to an event (`eventId` FK, `seatId` deterministic `<section>-<row>-<number>`).
- `TicketTier`: Pricing tier for an event (`eventId` FK, `name`, `priceMinor`, `currency`, `capacity`).
- `Order`: Customer order record with total amount, currency, status, and event association (`eventId` FK, `userId` index).
- `OrderItem`: Line item connecting an order to an individual event seat (`orderId` FK, `eventSeatId` FK, `price`).
- `Ticket`: Digital admission ticket with cryptographic seed version, face value, status (`ISSUED`, `CHECKED_IN`, `VOID`, `REVOKED`), and partial unique seat index (`uq_active_ticket_seat`).
- `GateScan`: Turnstile scan audit trail recording scan timestamps, scanner operator, and validation result (`VALID`, `USED`, `INVALID`, `EXPIRED`, `WRONG_EVENT`).
- `ResaleListing`: Secondary marketplace listings with anti-scalping price ceiling (max 110% face value), seller identity, and status lifecycle (`ACTIVE`, `SOLD`, `CANCELLED`).
- `LedgerEntry`: Balanced accounting journal recording platform commission and seller payouts on completed ticket transactions.
- `PlatformSetting`: Dynamic key-value configuration table storing system parameters such as `commission_rate_percent` (seeding default `'10'`).
- `AuditLog`: Immutable append-only audit log recording administrative interventions, fraud flags, revocations, and system actions.

---

## 4. Database Consistency Checks (`pnpm db:check`)

The `scripts/db-check.ts` validation suite runs in CI and can be executed locally. It strictly asserts 4 database invariants:

1. **`synchronize: true` Prohibition**: Scans the workspace code and runtime configurations to verify that TypeORM schema synchronization is completely disabled.
2. **Primary Key Requirement**: Queries the database catalog and entity metadatas to ensure every table has a defined Primary Key.
3. **Covering Index on Foreign Keys**: Inspects PostgreSQL foreign key constraints and asserts that every foreign key column is covered by a supporting index on its leading columns.
4. **Mongoose Schema Index Validation**: Scans all Mongoose schemas and models, ensuring index definitions compile and load without syntax errors or runtime exceptions.
