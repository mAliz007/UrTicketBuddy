# Checkout Module (`@urticketbuddy/api`)

Handles atomic seat hold acquisition via `@urticketbuddy/redis-scripts` and broadcasts hold state changes to Redis Pub/Sub for realtime WebSocket delivery.

## Endpoints

- `POST /api/v1/checkout/hold`
  - **Headers**: `x-user-id: <userId>` (temporary mock until UTB-3 auth guard integration)
  - **Body**: `{ eventId: string (UUID), seatIds: string[] }` (validated with `HoldRequestSchema`)
  - **201 Created**: `{ eventId, userId, seatIds, expiresAt }`
  - **409 Conflict**: Returned when `holdSeats` fails (e.g. `SEAT_ALREADY_HELD`, `SEAT_ALREADY_SOLD`, `TOO_MANY_SEATS`)
  - **Pub/Sub Side Effect**: Publishes `{ eventId, seatIds, state: "HELD", userId }` to `seat-updates:{eventId}`
