# @urticketbuddy/redis-scripts

High-performance atomic Redis Lua scripts and typed TypeScript wrappers.

## Scripts & Keys

- **Atomic Seat Hold**: `src/lua/seat-hold.lua` checks `seat_sold` set, executes `SET NX EX` on `seat_lock:{eventId}:{seatId}`, and tracks in `hold_expiry:{eventId}` and `user_holds:{eventId}:{userId}`.
- **Typed Wrapper**: `RedisScriptsWrapper` provides a clean typed API for Node services.
