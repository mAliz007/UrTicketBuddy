# Applications (`apps/`)

Applications in the UrTicketBuddy monorepo.

---

## Live Production Deployment

All applications are containerized and live on Oracle Cloud Infrastructure (OCI) Always Free Tier at `129.221.182.252`, orchestrated via `docker-compose.prod.yml`:

| Application                   | Local Dev Port | Production Routing        | Live Endpoint                                                                |
| :---------------------------- | :------------: | :------------------------ | :--------------------------------------------------------------------------- |
| **`@urticketbuddy/web`**      |     `5173`     | Nginx `/` (web:80)        | [http://129.221.182.252/](http://129.221.182.252/)                           |
| **`@urticketbuddy/tester`**   |     `5174`     | Standalone Dev Tool       | [http://localhost:5174/](http://localhost:5174/) (Endpoint Workbench)        |
| **`@urticketbuddy/api`**      |     `3000`     | Nginx `/api/` & `/health` | [http://129.221.182.252/api/v1/health](http://129.221.182.252/api/v1/health) |
| **`@urticketbuddy/realtime`** |     `3001`     | Nginx `/socket.io/`       | `ws://129.221.182.252/socket.io/`                                            |
| **`@urticketbuddy/worker`**   |     `3002`     | Internal                  | Background BullMQ processor (healthy)                                        |

---

## Apps Directory

- **[`@urticketbuddy/web`](./web)**: React 18 SPA built with Vite, TypeScript, Tailwind CSS, and Konva venue builder. Served via Nginx with client-side SPA fallback.
- **[`@urticketbuddy/tester`](./tester)**: Standalone Postman-like endpoint testing workbench running on dedicated port 5174 for hitting, testing, and debugging all UrTicketBuddy REST endpoints.
- **[`@urticketbuddy/api`](./api)**: NestJS core REST API modular monolith. Serves `/api/v1` REST endpoints and `/api/v1/health`.
- **[`@urticketbuddy/realtime`](./realtime)**: NestJS WebSocket gateway using Socket.io and Redis adapter for live atomic seat locks and room updates.
- **[`@urticketbuddy/worker`](./worker)**: NestJS standalone BullMQ queue processor handling seat hold expiry, order notifications, and ticket seed rotations. Exposes `/api/v1/health`.

---

## Architecture Rules

- Apps never import from each other directly.
- Shared domain logic, schemas, contracts, and math live exclusively in `packages/*`.
