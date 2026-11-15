# @urticketbuddy/worker

Background processing engine powered by NestJS and BullMQ.

## Tech Stack

- NestJS 11
- BullMQ
- ioredis

## Port & Endpoints

- Port: `3002` (Health check endpoint only)
- Health check: `GET /api/v1/health` (reports Redis status)

## Processors & Queues

- `hold-expiry`: Handles releasing seats when 10-minute hold timers expire
- `search-index`: Syncs event and venue changes to Elasticsearch
- `order-notifications`: Dispatches email/SMS confirmations
- `ticket-seed-rotation`: Rotates HMAC QR seeds periodically
