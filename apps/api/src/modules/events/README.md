# Events Module (`apps/api/src/modules/events`)

Manages ticketing events and mathematical parametric seat generation.

---

## 1. Overview

- **Events**: Created and linked directly to a physical venue (`venueId` FK).
- **Seat Generation**: Triggers on-demand parametric seat layout calculations using `@urticketbuddy/venue-engine`.
- **Chunked Bulk Insert**: Batches seat row insertions into PostgreSQL in chunks of 1,000 to prevent database memory exhaustion and maximum parameter overflow.
- **Port Implementation**: Implements `EventSeatCatalogPort` for querying seat availability across the platform.

---

## 2. Endpoints

### `POST /api/v1/events`

Creates a new event associated with an existing venue.

- **Request Body**:
  ```json
  {
    "venueId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Summer Music Festival 2026",
    "startTime": "2026-08-15T19:00:00.000Z",
    "status": "DRAFT"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "id": "7ca21e84-1823-4567-a2bc-3c963f66afa9",
    "venueId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Summer Music Festival 2026",
    "startTime": "2026-08-15T19:00:00.000Z",
    "status": "DRAFT",
    "createdAt": "2026-11-17T12:00:00.000Z",
    "updatedAt": "2026-11-17T12:00:00.000Z"
  }
  ```

### `GET /api/v1/events/:id`

Retrieves an event by UUID.

- **Response** (`200 OK`):
  ```json
  {
    "id": "7ca21e84-1823-4567-a2bc-3c963f66afa9",
    "venueId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "name": "Summer Music Festival 2026",
    "startTime": "2026-08-15T19:00:00.000Z",
    "status": "DRAFT"
  }
  ```

### `POST /api/v1/events/:id/generate-seats`

Calculates and persists all seat records into PostgreSQL based on the venue's MongoDB layout.

- **Response** (`200 OK`):
  ```json
  {
    "eventId": "7ca21e84-1823-4567-a2bc-3c963f66afa9",
    "venueId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "totalSeatsGenerated": 2500,
    "status": "COMPLETED"
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Event or associated venue does not exist.
  - `400 Bad Request`: Venue layout is invalid or missing in MongoDB.
