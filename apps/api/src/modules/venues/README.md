# Venues Module (`apps/api/src/modules/venues`)

Polyglot persistence venue management module combining PostgreSQL relational metadata with MongoDB venue layout documents.

---

## 1. Overview

- **PostgreSQL**: Stores physical venue metadata (`organizerId` indexed tenant identifier, `name`, `location`, `layoutMongoId`, `createdAt`, `updatedAt`).
- **MongoDB**: Stores rich, parametric venue layout configuration JSON adhering to the `VenueLayoutSchema` (from `@urticketbuddy/contracts`).
- **Validation**: Incoming layouts are strictly parsed and validated using `@urticketbuddy/venue-engine`'s `parseLayout` before persistence.
- **Authorization & Tenant Isolation**: `POST /api/v1/venues` requires `ORGANIZER` or `ADMIN` and enforces `OwnershipGuard`. `GET /api/v1/venues/:id` is `@Public()`.

---

## 2. Endpoints

### `POST /api/v1/venues`

Creates a new venue and its associated MongoDB layout document.

- **Request Body**:
  ```json
  {
    "name": "Madison Square Garden",
    "location": "New York, NY",
    "layout": {
      "schemaVersion": 1,
      "name": "MSG Standard Arena",
      "dimensions": { "width": 1000, "height": 800 },
      "sections": [
        {
          "type": "grid",
          "id": "sec-a",
          "name": "Section A",
          "origin": { "x": 50, "y": 50 },
          "rows": 10,
          "columns": 20,
          "seatWidth": 30,
          "gapX": 10,
          "gapY": 10
        }
      ]
    }
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Madison Square Garden",
    "location": "New York, NY",
    "layoutMongoId": "65e23f... ",
    "createdAt": "2026-11-17T12:00:00.000Z",
    "updatedAt": "2026-11-17T12:00:00.000Z"
  }
  ```
- **Error Responses**:
  - `400 Bad Request` (`VALIDATION_ERROR`): Thrown if `name`, `location`, or `layout` is missing, or if the layout fails geometric/schema constraints.

### `GET /api/v1/venues/:id`

Retrieves a venue from PostgreSQL and joins the complete MongoDB layout document.

- **Response** (`200 OK`):
  ```json
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Madison Square Garden",
    "location": "New York, NY",
    "layoutMongoId": "65e23f... ",
    "layout": { ... },
    "createdAt": "2026-11-17T12:00:00.000Z",
    "updatedAt": "2026-11-17T12:00:00.000Z"
  }
  ```
- **Error Responses**:
  - `404 Not Found` (`NOT_FOUND`): Thrown if venue ID does not exist in PostgreSQL.
