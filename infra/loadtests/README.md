# k6 High-Concurrency Stress & Load Tests (`infra/loadtests`)

1,000-Virtual-User (VU) stress testing suite, 5,000-seat benchmark seeder, and post-run PostgreSQL + Redis mathematical invariant verifier for **UTB-17**.

## Files & Architecture

| File                   | Description                                                                                                                                                                                              |
| :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `seed-loadtest.ts`     | Seeds 1 venue, 1 published event (`e0000000-0000-4000-8000-000000001000`), 5,000 `EventSeat` rows (`SEC-A-1-1` .. `SEC-A-50-100`), clears Redis locks, and writes 1,000 pre-signed JWTs to `users.json`. |
| `same-seat-1000.js`    | 1,000 VUs simultaneously `POST /api/v1/checkout/hold` for `SEC-A-1-1`. Asserts `holds_won == 1` and `holds_conflicted == 999`.                                                                           |
| `random-seats-1000.js` | 1,000 VUs contending for 1–4 random seats across 5,000 seats. Enforces `http_req_duration: ['p(95)<250']` and zero 5xx errors.                                                                           |
| `full-funnel.js`       | End-to-end hold (`POST /api/v1/checkout/hold`) → purchase (`POST /api/v1/orders/checkout` with `tok_visa`).                                                                                              |
| `ws-fanout-1000.js`    | 1,000 concurrent Socket.IO WebSocket connections to `apps/realtime` (`:3001`) joining `event:{eventId}` and measuring `seats-updated` broadcast latency.                                                 |
| `verify-invariants.ts` | Post-run CLI and library verifier checking Zero Double-Booking, State Exclusivity (`seat_sold` vs `seat_lock`), and Redis-PostgreSQL `SOLD` count parity.                                                |

## Usage

```bash
# 1. Seed 5,000 seats and generate 1,000 JWTs in infra/loadtests/users.json
pnpm --filter @urticketbuddy/db exec ts-node ../../infra/loadtests/seed-loadtest.ts

# (Optional) Generate users.json offline without touching Postgres/Redis
pnpm --filter @urticketbuddy/db exec ts-node ../../infra/loadtests/seed-loadtest.ts --tokens-only

# 2. Execute k6 scenarios
k6 run infra/loadtests/same-seat-1000.js
k6 run infra/loadtests/random-seats-1000.js
k6 run infra/loadtests/full-funnel.js
k6 run infra/loadtests/ws-fanout-1000.js

# 3. Run Post-Run DB & Redis Invariant Verifier
pnpm --filter @urticketbuddy/db exec ts-node ../../infra/loadtests/verify-invariants.ts

# 4. Run Automated 1,000-User Contention Jest Suite
pnpm --filter @urticketbuddy/api test -- test/concurrency-invariants.e2e-spec.ts
```
