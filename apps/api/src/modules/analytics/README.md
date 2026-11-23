# Analytics Module (`apps/api/src/modules/analytics`)

## Overview

The `AnalyticsModule` delivers real-time event performance, revenue, ticketing metrics, check-in velocity, active Redis seat holds, and secondary resale analytics for event organizers and system administrators.

Access is secured via `JwtAuthGuard`, `RolesGuard`, and tenant ownership isolation:

- Protected by `@Roles(UserRole.ORGANIZER, UserRole.ADMIN)`.
- Organizers may only access analytics for events they own (`event.organizerId === user.organizerTenantId || event.organizerId === user.id`). Unauthorized access returns `403 Forbidden` (`FORBIDDEN`).
- System Administrators (`ADMIN`) bypass tenant ownership restrictions and can inspect metrics across all events.

## Endpoints

### 1. Event Analytics

- **`GET /api/v1/organizer/analytics/:eventId`**
  - Path param: `eventId` (UUID)
  - Returns comprehensive event metrics adhering to `OrganizerAnalyticsResponse`:
    - `eventId`: UUID of the requested event.
    - `totalRevenue`: Aggregate gross sales in minor units (integer cents).
    - `ticketsSold`: Count of `ISSUED` and `CHECKED_IN` tickets.
    - `totalCapacity`: Total physical seat capacity derived from `event_seats`.
    - `occupancyRate`: Ratio of sold tickets to total capacity (percentage with 2 decimal precision).
    - `entryVelocity`: 5-minute bucketed entry throughput array parsed from `gate_scans` where `result = 'VALID'`, containing `{ timestamp: string, count: number }`.
    - `holdStats`: Active transient seat holds retrieved from Redis snapshot:
      - `held`: Count of currently held seats.
      - `sold`: Count of confirmed sold seats.
    - `resaleStats`: Secondary marketplace volume and completed resale transactions:
      - `activeListings`: Count of open resale listings.
      - `soldListings`: Total resale tickets purchased.
      - `totalResaleVolume`: Aggregate minor unit turnover from resales.

## Services & Architecture

### `AnalyticsService`

- Resolves the event from PostgreSQL via `EVENT_REPOSITORY` and enforces tenant ownership validation against the authenticated caller (`AnalyticsRequester`).
- Computes gross revenue from `ORDER_REPOSITORY` (`status` IN `COMPLETED`, `PAID`, `CONFIRMED`).
- Computes tickets sold from `TICKET_REPOSITORY` (`status` IN `ISSUED`, `CHECKED_IN`).
- Computes venue capacity and occupancy percentage from PostgreSQL `EVENT_SEAT_REPOSITORY`.
- Derives 5-minute check-in velocity buckets by aggregating timestamps from `GATE_SCAN_REPOSITORY` (`result = 'VALID'`).
- Queries transient hold counts and sold counts from Redis via `RedisScriptsWrapper.getCounts(eventId)`.
- Returns secondary market metrics (`resaleStats`).

## Tenant Security & Ownership

- An event has an optional or assigned `organizerId` representing the organizer's tenant ID or user ID.
- When an `ORGANIZER` requests analytics, the system asserts that either `event.organizerId` matches the caller's `organizerTenantId`, or `event.organizerId` matches the caller's `id`.
- If neither condition is met, a `ForbiddenException` with error code `FORBIDDEN` is thrown.
- Users with role `ADMIN` bypass tenant checks automatically.
