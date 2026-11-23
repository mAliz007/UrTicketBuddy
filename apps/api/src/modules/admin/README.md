# Admin Module (`apps/api/src/modules/admin`)

## Overview

The `AdminModule` provides platform administration, fraud intervention, ticket revocation with real-time seat recovery, immutable audit logging, and global platform configuration for UrTicketBuddy.

All endpoints are strictly protected by `JwtAuthGuard` and `RolesGuard`, restricted exclusively to the `ADMIN` role (`@Roles(UserRole.ADMIN)`).

## Endpoints

### 1. Order Fraud Flagging

- **`PATCH /api/v1/admin/orders/:orderId/flag`**
  - Marks an order's status as `FLAGGED`.
  - Increments `seedVersion` across all tickets associated with the order (`ticket.seedVersion += 1`), instantly invalidating existing dynamic QR token HMAC signatures and preventing gate entry.
  - Writes an immutable entry to `audit_logs` with action `ORDER_FLAGGED`.

### 2. Ticket Revocation & Seat Restoration

- **`DELETE /api/v1/admin/tickets/:ticketId`**
  - Marks the ticket status as `REVOKED` and increments its `seedVersion`.
  - Resets the associated `event_seats` record to `status = 'AVAILABLE'`.
  - Removes the seat from Redis sold set atomically via `RedisScriptsWrapper.unsellSeats(eventId, [seatId])` (`SREM seat_sold:{eventId}`).
  - Emits real-time availability updates via Redis Pub/Sub channels:
    - `seat-updates:{eventId}`: `{ seatId, status: 'AVAILABLE' }`
    - `seat.state`: `{ eventId, seatId, state: 'AVAILABLE' }`
  - Writes an immutable audit entry with action `TICKET_REVOKED`.

### 3. Global Platform Settings

- **`GET /api/v1/admin/settings/commission`**
  - Returns the active platform commission rate percentage (default `10`).
- **`PUT /api/v1/admin/settings/commission`**
  - Validates input using `UpdateCommissionRateSchema` (bounded between 0% and 50%).
  - Persists rate in `platform_settings` table under key `commission_rate_percent`.
  - Implements the `PlatformSettingsPort` contract for fee calculations across checkout and resale.
  - Writes an immutable audit entry with action `COMMISSION_RATE_UPDATED`.

### 4. User and Organizer Lifecycle Management

- **`PATCH /api/v1/admin/users/:userId/suspend`**
  - Marks user suspended and immediately revokes all issued refresh tokens in `refresh_tokens` (`isRevoked = true`).
  - Writes an immutable audit entry with action `USER_SUSPENDED`.
- **`PATCH /api/v1/admin/organizers/:userId/approve`**
  - Promotes user to `ORGANIZER` role and provisions an `organizerTenantId` (`org_<uuid>`) if not already present.
  - Writes an immutable audit entry with action `ORGANIZER_APPROVED`.

### 5. Append-Only Audit Trail

- **`GET /api/v1/admin/audit-logs`**
  - Filterable by `action`, `actorId`, and `entityType` with pagination (`page`, `pageSize`).
  - Returns paginated list of audit records ordered descending by `createdAt`.

## Services & Architecture

### `AdminService`

Coordinates administrative business logic, transactional integrity, cross-module repository interactions (orders, tickets, seats, users, refresh tokens), Redis script execution, and Redis Pub/Sub event broadcasting.

### `AuditService`

Encapsulates append-only audit trail logging.

- `recordLog(entry)`: Appends an immutable row to `audit_logs`.
- `getLogs(query)`: Queries and paginates audit log records.
- **Strict Immutability**: Exposes no update, edit, or delete methods.

### `PlatformSettingsService`

Concrete implementation of `PlatformSettingsPort`:

- `getSetting(key: string, defaultValue?: string): Promise<string>`
- `setSetting(key: string, value: string): Promise<void>`
- `getCommissionRate(): Promise<number>` (parses percentage string to number)
- `setCommissionRate(rate: number): Promise<void>`

### `AuditLogInterceptor`

NestJS execution interceptor that automatically captures admin mutation metadata (actor ID, role, action, entity type, target entity ID, IP address, and payload summary) and records an audit log asynchronously without blocking the client response.

## Database Immutability & Security

Audit log immutability is guaranteed at both the application level and the database engine level:

- PostgreSQL trigger `trg_audit_logs_immutable` and trigger function `audit_logs_immutable_fn()` raise an explicit SQL exception (`audit_logs table is append-only and cannot be updated or deleted`) on any `UPDATE` or `DELETE` statement executed against `audit_logs`.
- Foreign key and query performance is optimized via indices:
  - `idx_audit_logs_actor_id` on `actorId`
  - `idx_audit_logs_action` on `action`
  - `idx_audit_logs_created_at` on `createdAt`
