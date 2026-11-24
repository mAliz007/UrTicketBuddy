# Resale Marketplace Module (`apps/api/src/modules/resale`)

The **Capped P2P Resale Marketplace** implements **UTB-15**: a fair, scalper-resistant secondary ticket trading engine with a hard 110% price ceiling, distributed concurrency control via Redis locks, atomic double-entry split accounting, and automatic cryptographic dynamic QR invalidation upon ownership transfer.

---

## 🏛️ Architecture & Core Principles

1. **Anti-Scalping 110% Price Cap**:
   - Resale prices are capped at `maxResalePrice(faceValueMinor) = Math.floor((faceValueMinor * 110) / 100)`.
   - Any listing attempt exceeding this ceiling is rejected immediately with HTTP 400 (`RESALE_PRICE_CAP_EXCEEDED`).
   - Price updates can only lower the price or withdraw the listing; raising prices above the active listing price is prohibited.
2. **Distributed Concurrency Lock**:
   - Single-buyer exclusivity is enforced with Redis key `resale_lock:<listingId>` (`SET NX EX 300`).
   - Concurrent acquisition attempts fail fast with HTTP 409 (`CONFLICT`).
   - The lock is released safely using an atomic Lua script that verifies lock token ownership before deleting.
3. **Idempotency & Double-Charge Protection**:
   - `POST /api/v1/resale/listings/:listingId/purchase` strictly requires an `Idempotency-Key` header.
   - Successful purchase results are cached in Redis (`resale_idem:<listingId>:<buyerId>:<key>`, TTL 86400).
   - Retries with the same idempotency key return the cached result without duplicate billing or database mutations.
4. **Atomic Split Ledger Accounting**:
   - Platform commission is computed dynamically via `PlatformSettingsPort` (default 10% / `1000` basis points):
     $$\text{commissionMinor} = \left\lfloor \frac{\text{askingPriceMinor} \times \text{commissionRateBps}}{10000} \right\rfloor$$
     $$\text{sellerPayoutMinor} = \text{askingPriceMinor} - \text{commissionMinor}$$
   - Guarantees: $\text{commissionMinor} + \text{sellerPayoutMinor} \equiv \text{askingPriceMinor}$ (zero slippage).
   - Inserts two immutable `LedgerEntry` records (`PLATFORM_COMMISSION` and `SELLER_PAYOUT`) within a single PostgreSQL transaction.
5. **Cryptographic QR Seed Invalidation**:
   - Transferring ticket ownership instantly increments `ticket.seedVersion += 1`.
   - In accordance with Decision **D-3**, this immediately invalidates the seller's previous 30-second HMAC-SHA256 QR tokens at turnstiles (`/api/v1/gate/scan` returns `400 TICKET_INVALID`).
   - The new owner receives fresh valid dynamic QR tokens derived from the incremented seed version.

---

## 🔌 API Endpoints

### 1. List Ticket for Resale

- **Method / Path**: `POST /api/v1/resale/listings`
- **Auth**: JWT (`CUSTOMER`, `ADMIN`)
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "ticketId": "33333333-3333-4333-8333-333333333333",
    "askingPriceMinor": 11000
  }
  ```
- **Responses**:
  - `201 Created`: Returns created `ResaleListing` entity.
  - `400 Bad Request`: Validation failure or `RESALE_PRICE_CAP_EXCEEDED` if `askingPriceMinor > maxResalePrice(faceValueMinor)`.
  - `403 Forbidden`: Caller does not own the ticket.
  - `404 Not Found`: Ticket does not exist.
  - `409 Conflict`: Ticket is not `ISSUED` (e.g. `CHECKED_IN`, `VOID`, `REVOKED`), event already started, or an `ACTIVE` listing already exists for this ticket (`uq_resale_listings_active_ticket`).

---

### 2. Update or Withdraw Resale Listing

- **Method / Path**: `PATCH /api/v1/resale/listings/:listingId`
- **Auth**: JWT (Seller only)
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "askingPriceMinor": 10500,
    "status": "WITHDRAWN"
  }
  ```
- **Responses**:
  - `200 OK`: Returns updated `ResaleListing` entity.
  - `400 Bad Request`: `askingPriceMinor` raised above current price, exceeds 110% cap, or empty update body.
  - `403 Forbidden`: Caller is not the seller.
  - `404 Not Found`: Listing does not exist.
  - `409 Conflict`: Listing is not `ACTIVE` (already `WITHDRAWN` or `SOLD`), or listing is currently locked by an in-progress purchase.

---

### 3. Browse Active Resale Listings

- **Method / Path**: `GET /api/v1/resale/listings`
- **Auth**: `@Public()` (No auth required)
- **Query Parameters**:
  - `eventId` (optional): UUID of event to filter by.
  - `page` (optional): Page number (default `1`).
  - `pageSize` (optional): Items per page (default `20`, max `100`).
- **Response `200 OK`**:
  ```json
  {
    "items": [
      {
        "id": "55555555-5555-4555-8555-555555555555",
        "ticketId": "33333333-3333-4333-8333-333333333333",
        "eventId": "44444444-4444-4444-8444-444444444444",
        "sellerId": "11111111-1111-4111-8111-111111111111",
        "askingPriceMinor": 10500,
        "status": "ACTIVE",
        "createdAt": "2026-11-21T10:00:00.000Z",
        "updatedAt": "2026-11-21T10:00:00.000Z"
      }
    ],
    "page": 1,
    "pageSize": 20,
    "total": 1
  }
  ```

---

### 4. Purchase Resale Listing

- **Method / Path**: `POST /api/v1/resale/listings/:listingId/purchase`
- **Auth**: JWT (`CUSTOMER`, `ADMIN`)
- **Headers**:
  - `Content-Type: application/json`
  - `Idempotency-Key: <unique-uuid>` _(Mandatory)_
- **Request Body**:
  ```json
  {
    "paymentMethodToken": "tok_visa"
  }
  ```
- **Responses**:
  - `201 Created`:
    ```json
    {
      "listingId": "55555555-5555-4555-8555-555555555555",
      "ticketId": "33333333-3333-4333-8333-333333333333",
      "eventId": "44444444-4444-4444-8444-444444444444",
      "previousOwnerId": "11111111-1111-4111-8111-111111111111",
      "buyerId": "22222222-2222-4222-8222-222222222222",
      "askingPriceMinor": 10500,
      "commissionMinor": 1050,
      "sellerPayoutMinor": 9450,
      "seedVersion": 2,
      "status": "SOLD",
      "transactionId": "txn_12345"
    }
    ```
  - `400 Bad Request`: Missing `Idempotency-Key`, invalid body, or payment failure (`PAYMENT_FAILED`).
  - `404 Not Found`: Listing does not exist.
  - `409 Conflict`: Listing locked by another buyer, seller attempting to purchase their own ticket, listing no longer `ACTIVE`, event already started, or ticket no longer `ISSUED`.

---

## 🗄️ Database Entities & Constraints

### `resale_listings` Table

- `id` (uuid, PK)
- `ticketId` (uuid, FK `tickets.id` ON DELETE CASCADE, indexed `idx_resale_listings_ticket_id`)
- `eventId` (uuid, FK `events.id` ON DELETE CASCADE, indexed `idx_resale_listings_event_id`)
- `sellerId` (varchar(255), indexed `idx_resale_listings_seller_id`)
- `askingPriceMinor` (integer NOT NULL)
- `status` (varchar(50) DEFAULT `'ACTIVE'`)
- `createdAt` / `updatedAt` (timestamp with time zone)
- **Constraint**: `uq_resale_listings_active_ticket` UNIQUE (`ticketId`) WHERE `status = 'ACTIVE'` (guarantees at most one active listing per ticket).

### `ledger_entries` Table

- `id` (uuid, PK)
- `listingId` (uuid, FK `resale_listings.id` ON DELETE RESTRICT, indexed `idx_ledger_entries_listing_id`)
- `account` (varchar(255) NOT NULL, e.g. `'platform:commission'`, `'seller:<sellerId>'`)
- `amountMinor` (integer NOT NULL)
- `kind` (varchar(50) NOT NULL: `'PLATFORM_COMMISSION'` | `'SELLER_PAYOUT'`)
- `createdAt` (timestamp with time zone)

---

## 🧪 Verification & Testing

- **Contracts Unit Tests**: `packages/contracts/src/index.spec.ts` (110% boundary, 1 minor unit above cap, 0, large values, and Zod schemas).
- **Service Unit Tests**: `apps/api/src/modules/resale/resale.service.spec.ts` (18 test scenarios covering cap verification, withdrawal, pricing rules, commission split, error paths, and compensating refund).
- **Supertest E2E Integration**: `apps/api/test/resale.e2e-spec.ts` (8 scenarios covering full API lifecycle, concurrent racing, idempotency retry, payment failure release, and gate scanner token rejection).
