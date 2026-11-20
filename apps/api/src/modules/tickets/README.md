# Tickets Module (`apps/api/src/modules/tickets`)

The **Tickets Module** implements the core cryptographic token generation, seed rotation, and wallet functionality for **UrTicketBuddy** in compliance with Architectural Decision **D-3**.

## Architecture & Cryptography (Decision D-3)

- **30-Second Time-Decaying Tokens**:
  Tokens are time-decayed using 30-second windows calculated as `window = Math.floor(Date.now() / 1000 / 30)`.
- **HKDF-SHA256 Key Derivation**:
  Per-ticket cryptographic keys are derived using RFC 5869 HKDF-SHA256:
  `derivedKey = HKDF(MASTER_TICKET_SECRET, salt=0, info="${ticketId}:${seedVersion}", len=32)`.
- **HMAC-SHA256 Signature**:
  `hmac = HMAC-SHA256(derivedKey, "${ticketId}:${window}").digest("base64url")`.
- **Token Wire Payload**:
  `token = base64url("${ticketId}.${window}.${hmac}")`.
- **Constant-Time Verification**:
  Token verification utilizes `crypto.timingSafeEqual` over window interval `[currentWindow - 1, currentWindow]` (1 window of clock skew tolerance).
- **Key Rotation**:
  Admins can trigger key rotation (`PATCH /api/v1/tickets/:ticketId/rotate-key`), which increments `seedVersion` by 1. Because the derived key depends on `seedVersion`, all existing QR tokens and screenshots become immediately invalid.

## Endpoints

| Method  | Endpoint                               | Access                           | Description                                                 |
| ------- | -------------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| `GET`   | `/api/v1/tickets/:ticketId/dynamic-qr` | Ticket Owner, Admin              | Generates fresh 30-second rotating dynamic QR token payload |
| `PATCH` | `/api/v1/tickets/:ticketId/rotate-key` | Admin (`@Roles(UserRole.ADMIN)`) | Increments `seedVersion`, invalidating prior tokens         |
| `GET`   | `/api/v1/users/me/tickets`             | Authenticated User               | Retrieves all tickets owned by the caller                   |
| `GET`   | `/api/v1/tickets/me`                   | Authenticated User               | Alias convenience endpoint for wallet tickets               |

## Database Entities

- **`Ticket` (`tickets` table)**:
  - `id` (`uuid` PK, default `gen_random_uuid()`)
  - `eventId` (`uuid` FK -> `events.id` ON DELETE CASCADE, indexed)
  - `eventSeatId` (`uuid` FK -> `event_seats.id` ON DELETE CASCADE, indexed)
  - `orderId` (`uuid` FK -> `orders.id` ON DELETE CASCADE, indexed)
  - `ownerId` (`varchar(255)`, indexed)
  - `status` (`varchar(50)`: `ISSUED`, `CHECKED_IN`, `VOID`, `REVOKED`)
  - `seedVersion` (`integer`, default `1`)
  - `faceValueMinor` (`integer`, default `100000`)
  - `createdAt`, `updatedAt` (`timestamptz`)
