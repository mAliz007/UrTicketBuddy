# @urticketbuddy/realtime

High-concurrency WebSocket gateway for seat state updates and room broadcasts.

## Tech Stack

- NestJS 11
- Socket.io with Redis adapter
- ioredis

## Port & Endpoints

- Port: `3001`
- Health check: `GET /api/v1/health` (reports Redis status)
- Socket events:
  - Client emits `room:join` and `room:leave` with `{ eventId }`
  - Server emits `seat:state` to `event:{eventId}` room
