# Packages

Shared libraries and tooling for the UrTicketBuddy monorepo.

## Package Directory

- [`@urticketbuddy/config`](./config): Shared tsconfig, eslint, and prettier bases, plus the Zod environment schema loader. Owned by Member A.
- [`@urticketbuddy/contracts`](./contracts): Domain enums, error envelopes, pagination schemas, seat hold request/response schemas, WebSocket event contracts, BullMQ job schemas. Owned by Member C.
- [`@urticketbuddy/db`](./db): TypeORM DataSource, database entities, and migrations for Postgres. Owned by Member A.
- [`@urticketbuddy/redis-scripts`](./redis-scripts): Atomic Redis Lua seat-locking engine (`hold_seats`, `release_seats`, `confirm_sold`, `unsell_seats`, `extend_hold`, `expire_due`) and typed `ioredis` wrappers (`getSnapshot`, `getCounts`). Owned by Member C.
- [`@urticketbuddy/venue-engine`](./venue-engine): Pure TypeScript parametric venue layout math (no DOM). Owned by Member B.

## Guidelines

- Apps never import from each other directly; they share code exclusively through `packages/*`.
- Each package provides its own unit tests (`jest`), typecheck, linting, and build configuration.
