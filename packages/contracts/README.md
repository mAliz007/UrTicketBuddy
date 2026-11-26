# @urticketbuddy/contracts

Shared domain contracts, DTO types, Zod schemas, enums, error envelopes, WebSocket events, and BullMQ job definitions across the UrTicketBuddy platform.

## Contents

- **Enums**:
  - `UserRole`: `CUSTOMER`, `ORGANIZER`, `GATE_STAFF`, `ADMIN`
  - `TicketStatus`: `ISSUED`, `CHECKED_IN`, `VOID`, `REVOKED` (frozen decision D-2)
  - `SeatState`: `AVAILABLE`, `HELD`, `SOLD`, `DISABLED`
  - `SeatStateColors`: `AVAILABLE` (green), `HELD` (yellow), `SOLD` (red), `DISABLED` (grey)
  - `ResaleListingStatus`: `ACTIVE`, `SOLD`, `CANCELLED`
  - `ScanResult`: `VALID`, `USED`, `INVALID`, `EXPIRED`, `WRONG_EVENT`
  - `LedgerEntryType`: `PLATFORM_COMMISSION`, `SELLER_PAYOUT`
- **Errors**:
  - `ErrorCode` enum: Covering auth, seat locking (`SEAT_ALREADY_HELD`, `SEAT_NOT_HELD_BY_YOU`, `HOLD_EXPIRED`, `TOO_MANY_SEATS`), checkout (`PAYMENT_FAILED`, `SEAT_ALREADY_SOLD`), tickets & gate (`TICKET_NOT_FOUND`, `TICKET_INVALID`, `TICKET_ALREADY_USED`, `EVENT_MISMATCH`), and resale (`RESALE_PRICE_CAP_EXCEEDED`, `RESALE_LISTING_NOT_ACTIVE`, `CANNOT_BUY_OWN_LISTING`).
  - `ErrorEnvelopeSchema`: Standard `{ error: { code, message, details?, requestId? } }`.
- **Pagination**: `PaginationQuerySchema` (`page`, `pageSize` capped at 100) and `PaginatedResult<T>`.
- **Venue & Layout**: `VenueLayoutSchema`, `SeatNodeSchema`, `SectionAggregateSchema`.
- **Seat Holds & Concurrency**: `HoldRequestSchema` (`HoldRequest`), `HoldResponseSchema` (`HoldResponse` with UTC `expiresAt`).
- **Orders & Checkout**: `CheckoutOrderRequestSchema`, `OrderSummaryResponseSchema`.
- **Tickets & Dynamic QR**: `DynamicQrResponseSchema`, `RotateTicketKeySchema`.
- **Turnstile Scanner**: `ScanTicketSchema`, `ScanTicketResultSchema`, `GateMetricsResponseSchema`.
- **P2P Resale Marketplace**:
  - `maxResalePrice(faceValueMinor)`: Anti-scalping 110% price ceiling math.
  - `CreateResaleListingSchema`, `UpdateResaleListingSchema`, `PurchaseResaleListingSchema`.
- **Admin Suite & Analytics**: `SuspendUserSchema`, `ApproveOrganizerSchema`, `UpdateCommissionSettingSchema`, `OrganizerAnalyticsSchema`.
- **Sockets & Pub/Sub**: `SeatStateEventSchema`, `RoomJoinSchema`, `RoomLeaveSchema`, `SeatUpdatesEventSchema`.
- **BullMQ Background Jobs**: `HoldExpiryJobSchema`, `SearchIndexJobSchema`, `OrderNotificationJobSchema`, `TicketSeedRotationJobSchema`.
