# Resale Marketplace Module (`apps/api/src/modules/resale`)

Capped P2P Resale Marketplace API implementing **UTB-15**: 110% price ceiling enforcement, Redis distributed purchase locking, split commission ledger entries, and cryptographic QR seed rotation upon ownership transfer.

## Endpoints

| Method  | Path                                          | Auth                    | Description                                                                                       |
| :------ | :-------------------------------------------- | :---------------------- | :------------------------------------------------------------------------------------------------ |
| `POST`  | `/api/v1/resale/listings`                     | JWT                     | List an `ISSUED` ticket for a future event at `<= maxResalePrice(faceValueMinor)`                 |
| `PATCH` | `/api/v1/resale/listings/:listingId`          | JWT (Seller)            | Lower asking price or withdraw (`WITHDRAWN`)                                                      |
| `GET`   | `/api/v1/resale/listings`                     | `@Public()`             | Paginated browse of `ACTIVE` listings (`?eventId=&page=&pageSize=`)                               |
| `POST`  | `/api/v1/resale/listings/:listingId/purchase` | JWT + `Idempotency-Key` | Atomic purchase with Redis lock, split ledger entries, ownership transfer, and `seedVersion += 1` |

## Purchase Execution Flow

1. Require `Idempotency-Key` header and validate body (`PurchaseResaleListingSchema`).
2. Acquire Redis lock `resale_lock:<listingId>` (`SET NX EX 300`); reject concurrent buyers with `409 Conflict`.
3. Charge buyer via `PaymentProvider` (`MockPaymentService`); on failure, release lock and throw `400 PAYMENT_FAILED`.
4. Run a single PostgreSQL ACID transaction (`SELECT ... FOR UPDATE` on `resale_listings` and `tickets`):
   - Compute `commissionMinor = Math.floor((askingPriceMinor * commissionRateBps) / 10000)` using `PlatformSettingsPort` (default `1000` bps = 10%) and `sellerPayoutMinor = askingPriceMinor - commissionMinor`.
   - Insert 2 `LedgerEntry` rows (`PLATFORM_COMMISSION` + `SELLER_PAYOUT`) summing exactly to `askingPriceMinor`.
   - Transfer `ticket.ownerId = buyerId` and increment `ticket.seedVersion += 1` (immediately invalidating seller's old QR tokens).
   - Mark listing `SOLD`.
5. Emit `ticket.transferred` event and release `resale_lock:<listingId>`.
