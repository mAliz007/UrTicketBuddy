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
    - `entryVelocity`: 5-minute bucketed entry throughput parsed from `gate_scans` where `result = 'VALID'`, detailing `scans` and `cumulativeScans`.
    - `holdStats`: Active transient seat holds retrieved from Redis:
      - `activeHolds`: Count of currently held seats.
      - `heldSeats`: List of seat identifiers currently under hold.
      - `holdDropOffCount`: Number of expired holds detected.
    - `resaleStats`: Secondary marketplace volume and completed resale transactions:
      - `activeListings`: Count of open resale listings.
      - `soldCount`: Total resale tickets purchased.
      - `volume`: Aggregate minor unit turnover from resales.

## Services & Architecture

### `AnalyticsService`

- Resolves the event from PostgreSQL via `EVENT_REPOSITORY` and enforces tenant ownership validation against the authenticated caller (`AnalyticsRequester`).
- Computes gross revenue and tickets sold from PostgreSQL `TICKET_REPOSITORY` and `ORDER_ITEM_REPOSITORY`.
- Computes venue capacity and occupancy percentage from PostgreSQL `EVENT_SEAT_REPOSITORY`.
- Derives 5-minute check-in velocity buckets by aggregating timestamps from `GATE_SCAN_REPOSITORY` (`result = 'VALID'`).
- Queries transient hold counts and seat IDs from Redis via `RedisScriptsWrapper.getCounts(eventId)`.
- Queries secondary market metrics from `RESALE_LISTING_REPOSITORY` (or defaults gracefully when empty).

## Tenant Security & Ownership

- An event has an optional or assigned `organizerId` representing the organizer's tenant ID or user ID.
- When an `ORGANIZER` requests analytics, the system asserts that either `event.organizerId` matches the caller's `organizerTenantId`, or `event.organizerId` matches the caller's `id`.
- If neither condition is met, an `UnauthorizedException` with error code `FORBIDDEN` is thrown.
- Users with role `ADMIN` bypass tenant checks automatically.
