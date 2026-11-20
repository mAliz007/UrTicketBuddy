# Gate Scanner Module (`apps/api/src/modules/gate`)

The **Gate Scanner Module** provides turnstile scanning, fast cryptographic token verification, RedisBloom prefiltering, replay protection, and entry metrics for **UrTicketBuddy**.

## Multi-Stage Verification Pipeline

When a gate scanner scans a dynamic QR token (`POST /api/v1/gate/scan`), the request passes through the following security stages:

```
[QR Code Scanned]
        │
        ▼
0. Event Existence & Organizer Tenant Check
   ├── Event not found -> REJECT (404 Not Found)
   └── Scanner organizer mismatch -> REJECT (403 Forbidden)
        │
        ▼
1. Decode Base64url Payload (ticketId, window, hmac)
   └── Malformed payload -> Record audit (ticketId: null, scannedTicketRef: "malformed-token") -> REJECT (400 Bad Request)
        │
        ▼
2. RedisBloom Prefilter Check (`bf:tickets`)
   ├── False: Definite miss / forged token -> Record audit (ticketId: null, scannedTicketRef: ticketId) -> REJECT IMMEDIATELY (400 Bad Request)
   │          * ZERO PostgreSQL queries executed, avoids DB FK violation *
   └── True: Candidate ticket -> Proceed to stage 3
        │
        ▼
3. PostgreSQL Lookup & Event Verification
   ├── Ticket not found -> Record audit (ticketId: null, scannedTicketRef: ticketId) -> REJECT (400 Bad Request)
   └── Wrong event -> Record audit -> REJECT (400 Bad Request)
        │
        ▼
4. Early Status Check (Differentiate CHECKED_IN, REVOKED, VOID)
   ├── Status == CHECKED_IN -> Record audit (USED) -> REJECT (409 Conflict)
   ├── Status == REVOKED -> Record audit (INVALID) -> REJECT (409 Conflict)
   └── Status == VOID -> Record audit (INVALID) -> REJECT (409 Conflict)
        │
        ▼
5. Constant-Time HMAC & Strict Clock-Skew Verification
   ├── Window outside [currentWindow - 1, currentWindow] -> REJECT (400 Bad Request - EXPIRED)
   └── Signature mismatch / seed rotated -> REJECT (400 Bad Request - INVALID)
        │
        ▼
6. Redis Replay Protection (`SET qr_nonce:<ticketId>:<window> 1 EX 60 NX`)
   └── Key already exists -> Record audit (USED) -> REJECT (409 Conflict - USED)
        │
        ▼
7. Atomic PostgreSQL Status Transition & Nonce Rollback Guard
   ├── `UPDATE tickets SET status = 'CHECKED_IN' WHERE id = :id AND status = 'ISSUED'`
   │   ├── Affected rows == 0 -> Record audit (USED) -> REJECT (409 Conflict - USED)
   │   └── Transient DB error -> DEL `qr_nonce:<ticketId>:<window>` (prevents locking out patron) -> Rethrow
        │
        ▼
8. Record Audit Log (`GateScan` -> `VALID`) & Return 200 OK
```

## RedisBloom Prefilter (`BloomService`)

- **Redis Key**: `bf:tickets`
- **Fallback**: Graceful fallback to Redis SET (`bf:tickets:fallback`) if RedisBloom commands (`BF.ADD`, `BF.EXISTS`) are not available in local or mock environments.
- **Warming**: Populated during ticket issuance at checkout (`OrdersService.checkout()`) and chunked/pipelined (`take: 2000`, `pipeline.call("BF.ADD")`) from PostgreSQL `tickets` upon application startup.
- **Security Invariant**: The Bloom filter is a prefilter only. It quickly eliminates forged IDs with $O(1)$ operations, but never approves a scan without passing the cryptographic check and database update.

## Endpoints

| Method | Endpoint               | Access                             | Description                                                             |
| ------ | ---------------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| `POST` | `/api/v1/gate/scan`    | `GATE_STAFF`, `ORGANIZER`, `ADMIN` | Verifies dynamic QR token and checks in attendee                        |
| `GET`  | `/api/v1/gate/metrics` | `GATE_STAFF`, `ORGANIZER`, `ADMIN` | Calculates total scans, valid check-ins, rejections, and entry velocity |

## Database Entities

- **`GateScan` (`gate_scans` table)**:
  - `id` (`uuid` PK, default `gen_random_uuid()`)
  - `ticketId` (`uuid` FK -> `tickets.id` ON DELETE SET NULL, nullable for forged tokens, indexed)
  - `scannedTicketRef` (`varchar(255)`, nullable; safely stores the raw scanned ticket ID even if forged/unverified)
  - `eventId` (`uuid` FK -> `events.id` ON DELETE CASCADE, indexed)
  - `scannedBy` (`varchar(255)`)
  - `result` (`varchar(50)`: `VALID`, `USED`, `INVALID`, `EXPIRED`, `WRONG_EVENT`)
  - `scannedAt` (`timestamptz`, default `now()`)
  - **Covering Indexes**: `idx_gate_scans_ticket_id`, `idx_gate_scans_event_id`, composite index `idx_gate_scans_event_scanned_at` on `(eventId, scannedAt)` for high-throughput metric window aggregations.
