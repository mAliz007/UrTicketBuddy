# @urticketbuddy/realtime

High-concurrency WebSocket gateway for seat state updates and room broadcasts.

## Tech Stack

- NestJS 11
- Socket.io with Redis adapter
- ioredis

## Port & Endpoints

- Port: `3001`
- Health check: `GET /api/v1/health` (reports Redis status)
- Socket events (see [Realtime Gateway](src/gateway/README.md)):
  - Client emits `join-event` with `{ eventId }` (or `room:join` / `room:leave`) to join `event:{eventId}`
  - Server subscribes to Redis Pub/Sub `seat-updates:*` and emits `seats-updated` to `event:{eventId}`
