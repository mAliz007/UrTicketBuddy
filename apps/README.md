# Applications

Applications in the UrTicketBuddy monorepo.

## Apps Directory

- [`@urticketbuddy/web`](./web): React SPA built with Vite, TypeScript, and Tailwind CSS. Runs on port 5173.
- [`@urticketbuddy/api`](./api): NestJS core REST API modular monolith. Runs on port 3000. Serves `/api/v1/health`.
- [`@urticketbuddy/realtime`](./realtime): NestJS WebSocket gateway using Socket.io and Redis adapter. Runs on port 3001. Serves `/api/v1/health`.
- [`@urticketbuddy/worker`](./worker): NestJS standalone application running BullMQ background job processors. Exposes a health endpoint on port 3002 (`/api/v1/health`).

## Architecture Rules

- Apps never import from each other directly.
- Shared domain logic, schemas, and math live exclusively in `packages/*`.
