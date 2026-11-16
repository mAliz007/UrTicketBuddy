# `@urticketbuddy/redis-scripts`

Atomic Redis Lua seat-locking concurrency engine and typed `ioredis` wrappers for the **UrTicketBuddy** platform (`UTB-5`).

---

## Overview

All seat lock transitions execute inside Redis as single-threaded atomic Lua scripts. This eliminates race conditions and guarantees that under high concurrency (e.g., 500+ simultaneous checkout attempts on the same seat at the exact same millisecond), **exactly one buyer acquires the hold** and **zero partial locks** are left behind when multi-seat requests overlap.

---

## Redis Key Registry & Cluster Slot Affinity

Every key uses the `{eventId}` hash tag so all keys for an event map to the **exact same Redis hash slot** (`CRC16(eventId) % 16384`), preventing `CROSSSLOT` errors in Redis Cluster deployments:

| Key Pattern                          | Redis Type | TTL / Lifecycle        | Description                                                             |
| :----------------------------------- | :--------- | :--------------------- | :---------------------------------------------------------------------- |
| `seat_lock:{<eventId>}:<seatId>`     | `STRING`   | `EX 600` (+120s grace) | Value is the `userId` currently holding the seat.                       |
| `seat_sold:{<eventId>}`              | `SET`      | Persistent             | Set of `seatId`s confirmed as sold for the event.                       |
| `hold_expiry:{<eventId>}`            | `ZSET`     | Managed by scripts     | Score = UTC expiry epoch (`ms`), Member = `seatId`.                     |
| `user_holds:{<eventId>}:<userId>`    | `SET`      | Managed by scripts     | Set of `seatId`s currently held by `userId` (used for `maxPerUser`).    |
| `hold_extended:{<eventId>}:<userId>` | `STRING`   | Persistent per event   | Tracks whether `userId` has already consumed their one-time 120s grace. |

---

## Atomic Lua Scripts (`packages/redis-scripts/lua`)

1. **`hold_seats.lua`**
   - **Input**: `(eventId, userId, seatIds[], ttlSeconds, maxPerUser, nowMs)`
   - **Guarantees**:
     - Atomically checks every requested `seatId`. If **any** seat is in `seat_sold:{eventId}` or has a live `seat_lock:{eventId}:<seatId>` owned by another user, **changes nothing** and returns `{ 0, "SEAT_ALREADY_HELD", conflictingSeatIds }`.
     - Prunes stale/expired entries from `user_holds:{eventId}:{userId}` and verifies that `activeExistingHolds + newSeats <= maxPerUser`. If exceeded, **changes nothing** and returns `{ 0, "TOO_MANY_SEATS", {} }`.
     - Otherwise sets `SET seat_lock:{eventId}:<seatId> <userId> EX <ttlSeconds>`, records expiry timestamps via `ZADD hold_expiry:{eventId} <expiresAtMs> <seatId>`, and adds seats to `SADD user_holds:{eventId}:{userId} <seatId>`.

2. **`release_seats.lua`**
   - **Input**: `(eventId, userId, seatIds[])`
   - **Guarantees**: Verifies that every seat in `seatIds[]` is currently locked by `userId`. If any seat is not owned by `userId`, changes nothing and returns `{ 0, "SEAT_NOT_HELD_BY_YOU", failedSeats }`. Otherwise deletes `seat_lock`, removes from `hold_expiry`, and removes from `user_holds`.

3. **`confirm_sold.lua`**
   - **Input**: `(eventId, userId, seatIds[], nowMs)`
   - **Guarantees**: Verifies that every seat has a live, non-expired lock owned by `userId` (returning `SEAT_NOT_HELD_BY_YOU` or `HOLD_EXPIRED` on failure). Moves seats to `seat_sold:{eventId}`, deletes `seat_lock` keys, and removes entries from `hold_expiry` and `user_holds`.

4. **`unsell_seats.lua`**
   - **Input**: `(eventId, seatIds[])`
   - **Guarantees**: Removes specified `seatIds` from `seat_sold:{eventId}` (`SREM`) for administrative ticket revocation.

5. **`extend_hold.lua`**
   - **Input**: `(eventId, userId, seatIds[]?, graceSeconds = 120, nowMs)`
   - **Guarantees**: Enforces a strict **once-per-user-per-event** grace period extension via `hold_extended:{eventId}:{userId}`. Adds `120s` (`120,000 ms`) to each owned seat's `PTTL` and `hold_expiry` score.

6. **`expire_due.lua`**
   - **Input**: `(eventId, nowMs)`
   - **Guarantees**: Scans `hold_expiry:{eventId}` and removes any seat whose `seat_lock` key is gone or whose expiry score is `<= nowMs`, cleaning up `seat_lock`, `user_holds`, and `hold_expiry`, and returning the list of freed `seatId`s.

---

## TypeScript API (`src/index.ts`)

Uses `ioredis` `defineCommand` to register all 6 scripts with full TypeScript types:

```ts
import Redis from "ioredis";
import { RedisScriptsWrapper } from "@urticketbuddy/redis-scripts";

const redis = new Redis(process.env.REDIS_URL);
const seatLocks = new RedisScriptsWrapper(redis);

// 1. Hold seats atomically
const hold = await seatLocks.holdSeats({
  eventId: "123e4567-e89b-12d3-a456-426614174000",
  userId: "987e6543-e21b-12d3-a456-426614174000",
  seatIds: ["SEC1-A-1", "SEC1-A-2"],
  ttlSeconds: 600,
  maxPerUser: 6,
});

// 2. Extend hold once (+120s grace period)
const extended = await seatLocks.extendHold(
  "123e4567-e89b-12d3-a456-426614174000",
  "987e6543-e21b-12d3-a456-426614174000",
  ["SEC1-A-1", "SEC1-A-2"],
);

// 3. Confirm sold on checkout completion
await seatLocks.confirmSold(
  "123e4567-e89b-12d3-a456-426614174000",
  "987e6543-e21b-12d3-a456-426614174000",
  ["SEC1-A-1", "SEC1-A-2"],
);

// 4. Inspect event seat state snapshot and counts
const snapshot = await seatLocks.getSnapshot(
  "123e4567-e89b-12d3-a456-426614174000",
);
const counts = await seatLocks.getCounts(
  "123e4567-e89b-12d3-a456-426614174000",
);
```
