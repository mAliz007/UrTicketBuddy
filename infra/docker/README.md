# Production Dockerization (`infra/docker`)

Optimized, secure multi-stage Dockerfiles and container configurations for UrTicketBuddy microservices and frontend application.

## Container Architecture

### 1. Backend Microservices (`api`, `realtime`, `worker`)

Each backend microservice follows a standardized 4-stage Alpine Dockerfile located in `docker/` (and mirrored in `apps/<service>/Dockerfile`):

1. **`deps` (`node:22-alpine`)**:
   - Activates Corepack and pins `pnpm@12.21.0`.
   - Copies workspace manifests (`pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`).
   - Copies package manifests across all internal packages for optimal Docker layer caching.
   - Executes `pnpm install --frozen-lockfile`.

2. **`build`**:
   - Copies workspace packages (`packages/`) and the target microservice (`apps/<service>/`).
   - Compiles internal packages and service bundles via `pnpm --filter @urticketbuddy/<service>... build`.

3. **`prod-deps`**:
   - Runs `pnpm --filter @urticketbuddy/<service> deploy --prod --prefer-offline /out/<service>`.
   - Generates an isolated production `node_modules` directory with all workspace symlinks resolved and `devDependencies` stripped.

4. **`production` (`node:22-alpine`)**:
   - Minimal runtime image executing strictly as non-root user `node` (`USER node`, UID 1000).
   - Installs `tini` as entrypoint for POSIX signal forwarding (`SIGTERM`/`SIGINT`).
   - Sets `NODE_ENV=production`.
   - Copies pruned production `node_modules/`, `dist/`, and `package.json` with `--chown=node:node`.
   - Configures container health check probing `GET /api/v1/health` via busybox `wget -q --spider`.

### 2. Frontend React SPA (`apps/web/Dockerfile` & `infra/docker/Dockerfile.web`)

Multi-stage build compiling the React SPA into static assets and serving them through an ultra-lightweight Nginx Alpine web server:

1. **Builder Stage**:
   - Node 22 Alpine builder running `pnpm --filter @urticketbuddy/web build`.
   - Generates compiled, minified bundle in `apps/web/dist/`.

2. **Runner Stage (`nginx:alpine`)**:
   - Copies compiled HTML/JS/CSS to `/usr/share/nginx/html`.
   - Configures SPA client-side routing fallback (`try_files $uri $uri/ /index.html;`).
   - Exposes port `80` to the internal Docker network.

---

## Production Secrets & Environment Validation

`@urticketbuddy/config` enforces strict environment schema validation via Zod:

- In `NODE_ENV=production`, `MASTER_TICKET_SECRET` **must not** equal the development default (`dev-master-ticket-secret-32-chars-long-key`).
- The CD pipeline automatically generates a cryptographically secure 64-character hex secret (`openssl rand -hex 32`) on the host VM if not already set.
- `JWT_SECRET` and `JWT_REFRESH_SECRET` must have a minimum length of 16 characters.

---

## Service Matrix (`docker-compose.prod.yml`)

| Service           | Image                               | Internal Port |  Host Port  | Role                                                      |
| :---------------- | :---------------------------------- | :-----------: | :---------: | :-------------------------------------------------------- |
| **postgres**      | `postgres:16-alpine`                |    `5432`     |   `5432`    | Relational database (users, tickets, orders, audit logs)  |
| **pgbouncer**     | `edoburu/pgbouncer:latest`          |    `6432`     |   `6432`    | Connection pooler in transaction mode                     |
| **mongo**         | `mongo:7.0`                         |    `27017`    |   `27017`   | Document database for parametric venue layouts            |
| **redis**         | `redis/redis-stack-server:latest`   |    `6379`     |   `6379`    | In-memory store with RedisBloom and seat lock Lua scripts |
| **elasticsearch** | `elasticsearch:8.17.2`              |    `9200`     |   `9200`    | Read-model search engine                                  |
| **api**           | `urticketbuddy/api:production`      |    `3000`     |   `3000`    | Core NestJS REST API                                      |
| **realtime**      | `urticketbuddy/realtime:production` |    `3001`     |   `3001`    | Socket.io WebSocket gateway                               |
| **worker**        | `urticketbuddy/worker:production`   |    `3002`     |   `3002`    | BullMQ background queue processors                        |
| **web**           | `urticketbuddy/web:production`      |     `80`      |      -      | Compiled Vite React SPA                                   |
| **nginx**         | `nginx:alpine`                      |     `80`      | `80`, `443` | Reverse proxy routing `/` to web and `/api` to backend    |

---

## Local Verification Commands

```bash
# Build all production container images
pnpm up:prod

# Check container health status
docker compose -f docker-compose.prod.yml ps

# Teardown stack
pnpm down:prod
```
