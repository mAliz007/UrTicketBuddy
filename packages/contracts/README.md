# @urticketbuddy/contracts

Shared domain contracts, DTO types, enums, error envelopes, WebSocket events, and BullMQ job definitions.

## Contents

- **Enums**: `TicketStatus` (ISSUED, CHECKED_IN, VOID, REVOKED), `SeatState` (AVAILABLE, HELD, SOLD, DISABLED), `SeatStateColors`
- **Errors**: `ErrorCode` enum (including `SEAT_ALREADY_HELD`, `SEAT_NOT_HELD_BY_YOU`, `HOLD_EXPIRED`, `TOO_MANY_SEATS`) and `ErrorEnvelopeSchema` ({ error: { code, message, details?, requestId? } })
- **Pagination**: `PaginationQuerySchema` and `PaginatedResult<T>`
- **Sockets**: `SeatStateEventSchema`, `RoomJoinSchema`, `RoomLeaveSchema`
- **Seats**: `HoldRequestSchema` (`HoldRequest`) and `HoldResponseSchema` (`HoldResponse` with `expiresAt`)
- **Jobs**: `HoldExpiryJobSchema`, `SearchIndexJobSchema`, `OrderNotificationJobSchema`, `TicketSeedRotationJobSchema`
