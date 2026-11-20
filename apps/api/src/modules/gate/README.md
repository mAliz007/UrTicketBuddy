# Gate Scanner Module (`apps/api/src/modules/gate`)

The **Gate Scanner Module** provides turnstile scanning, fast cryptographic token verification, RedisBloom prefiltering, replay protection, and entry metrics for **UrTicketBuddy**.

## Multi-Stage Verification Pipeline

When a gate scanner scans a dynamic QR token (`POST /api/v1/gate/scan`), the request passes through the following security stages:

```
[QR Code Scanned]
        │
        ▼
1. Decode Base64url Payload (ticketId, window, hmac)
        │
        ▼
2. RedisBloom Prefilter Check (`bf:tickets`)
   ├── False: Definite miss / forged token -> REJECT IMMEDIATELY (400 Bad Request)
   │          * ZERO PostgreSQL queries executed *
   └── True: Candidate ticket -> Proceed to stage 3
        │
        ▼
3. PostgreSQL Lookup & Tenant/Event Verification
   ├── Ticket not found -> REJECT (400 Bad Request)
   └── Wrong event -> REJECT (400 Bad Request)
        │
        ▼
4. Constant-Time HMAC & Clock-Skew Verification
   ├── Time window expired (> 30s + 1 window skew) -> REJECT (400 Bad Request - EXPIRED)
   └── Signature mismatch / seed rotated -> REJECT (400 Bad Request - INVALID)
        │
        ▼
5. Redis Replay Protection (`SET qr_nonce:<ticketId>:<window> 1 EX 60 NX`)
   └── Key already exists -> REJECT (409 Conflict - USED)
        │
        ▼
6. Atomic PostgreSQL Status Transition
   └── `UPDATE tickets SET status = 'CHECKED_IN' WHERE id = :id AND status = 'ISSUED'`
       └── Affected rows = 0 -> REJECT (409 Conflict - USED)
        │
        ▼
7. Record Audit Log (`GateScan` -> `VALID`) & Return 200 OK
```

## RedisBloom Prefilter (`BloomService`)

- **Redis Key**: `bf:tickets`
- **Fallback**: Graceful fallback to Redis SET (`bf:tickets:fallback`) if RedisBloom commands (`BF.ADD`, `BF.EXISTS`) are not available in local or mock environments.
- **Warming**: Populated during ticket issuance at checkout (`OrdersService.checkout()`) and refreshed from PostgreSQL `tickets` upon application startup.
- **Security Invariant**: The Bloom filter is a prefilter only. It quickly eliminates forged IDs with $O(1)$ operations, but never approves a scan without passing the cryptographic check and database update.

## Endpoints

| Method | Endpoint               | Access                             | Description                                                             |
| ------ | ---------------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| `POST` | `/api/v1/gate/scan`    | `GATE_STAFF`, `ORGANIZER`, `ADMIN` | Verifies dynamic QR token and checks in attendee                        |
| `GET`  | `/api/v1/gate/metrics` | `GATE_STAFF`, `ORGANIZER`, `ADMIN` | Calculates total scans, valid check-ins, rejections, and entry velocity |

## Database Entities

- **`GateScan` (`gate_scans` table)**:
  - `id` (`uuid` PK, default `gen_random_uuid()`)
  - `ticketId` (`uuid` FK -> `tickets.id` ON DELETE CASCADE, nullable for forged tokens, indexed)
  - `eventId` (`uuid` FK -> `events.id` ON DELETE CASCADE, indexed)
  - `scannedBy` (`varchar(255)`)
  - `result` (`varchar(50)`: `VALID`, `USED`, `INVALID`, `EXPIRED`, `WRONG_EVENT`)
  - `scannedAt` (`timestamptz`, default `now()`)
