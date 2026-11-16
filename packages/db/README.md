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
```

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

### Baseline Migration

The initial baseline migration enables essential PostgreSQL extensions:

- `pgcrypto` (cryptographic primitives & UUID generation)
- `uuid-ossp` (standard UUID algorithms)

---

## 4. Database Consistency Checks (`pnpm db:check`)

The `scripts/db-check.ts` validation suite runs in CI and can be executed locally. It strictly asserts 4 database invariants:

1. **`synchronize: true` Prohibition**: Scans the workspace code and runtime configurations to verify that TypeORM schema synchronization is completely disabled.
2. **Primary Key Requirement**: Queries the database catalog and entity metadatas to ensure every table has a defined Primary Key.
3. **Covering Index on Foreign Keys**: Inspects PostgreSQL foreign key constraints and asserts that every foreign key column is covered by a supporting index on its leading columns.
4. **Mongoose Schema Index Validation**: Scans all Mongoose schemas and models, ensuring index definitions compile and load without syntax errors or runtime exceptions.
