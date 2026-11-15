# @urticketbuddy/contracts

Shared domain contracts, DTO types, enums, error envelopes, WebSocket events, and BullMQ job definitions.

## Contents

- **Enums**: `TicketStatus` (ISSUED, CHECKED_IN, VOID, REVOKED), `SeatState` (AVAILABLE, HELD, SOLD, DISABLED), `SeatStateColors`
- **Errors**: `ErrorCode` enum and `ErrorEnvelopeSchema` ({ error: { code, message, details?, requestId? } })
- **Pagination**: `PaginationQuerySchema` and `PaginatedResult<T>`
- **Sockets**: `SeatStateEventSchema`, `RoomJoinSchema`, `RoomLeaveSchema`
- **Jobs**: `HoldExpiryJobSchema`, `SearchIndexJobSchema`, `OrderNotificationJobSchema`, `TicketSeedRotationJobSchema`
