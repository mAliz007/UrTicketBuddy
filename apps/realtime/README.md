# @urticketbuddy/realtime

High-concurrency WebSocket gateway for seat state updates and room broadcasts.

## Tech Stack

- NestJS 11
- Socket.io with Redis adapter
- ioredis

## Port & Endpoints

- Port: `3001` (Replica 1), `3011` (Replica 2 under `docker compose --profile scale`)
- Health check: `GET /api/v1/health` (reports Redis status)
- Socket events & security (see [Realtime Gateway](src/gateway/README.md)):
  - **JWT Handshake Auth**: Validates HMAC-SHA256 JWT token via `handshake.auth.token`, `Authorization: Bearer`, or `query.token` before allowing connection.
  - **Redis Adapter**: Configured with `@socket.io/redis-adapter` for horizontal multi-replica room broadcasting behind Nginx `realtime_upstream`.
  - **Room Management**: Client emits `room:join` / `room:leave` with `{ eventId }` (or `join-event`) to join/leave `event:{eventId}`.
  - **State Broadcasts**: Server subscribes to Redis Pub/Sub channel `seat.state` (and `seat-updates:*`) and emits `seat:state` (and `seats-updated`) to room `event:{eventId}`.
