# @urticketbuddy/db

Postgres database configuration, TypeORM DataSource, entities, and migration tooling.

## Scripts

- `pnpm db:migrate` - Run pending migrations
- `pnpm db:revert` - Revert the latest migration
- `pnpm db:generate` - Generate a new migration based on schema changes
- `pnpm db:check` - Check migration status and database connectivity

## Conventions

- Connected through PgBouncer (port 6432) in transaction mode.
- Synchronize is strictly disabled.
- Migrations follow `<timestamp>-UTB-<n>-<description>.ts`.
