# Realtime Gateway (`@urticketbuddy/realtime`)

Socket.io WebSocket gateway that bridges Redis Pub/Sub seat state updates to connected event rooms.

## Events

- **Client -> Server**: `join-event` with `{ eventId: string }` (or `string`). Adds the socket to room `event:{eventId}`.
- **Redis Pub/Sub Listener**: Subscribes to `seat-updates:*` via `ioredis` `psubscribe`.
- **Server -> Client**: Broadcasts `seats-updated` to room `event:{eventId}` with `{ eventId, seatIds, state, userId }`.
