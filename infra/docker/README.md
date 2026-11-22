# Production Dockerization (`infra/docker`)

Optimized, secure multi-stage Dockerfiles for UrTicketBuddy NestJS microservices.

## Architecture

Each microservice (`apps/api`, `apps/realtime`, `apps/worker`) follows a three-stage build pattern:

1. **Builder Stage (`node:22-alpine`)**:
   - Enables Corepack and activates `pnpm@12.21.0`.
   - Copies root workspace manifests (`pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`).
   - Copies internal workspace packages (`packages/`) and the target service (`apps/<service>`).
   - Executes `pnpm install --frozen-lockfile` to resolve workspace dependencies.

2. **Build Stage**:
   - Compiles workspace packages and NestJS application artifacts via `pnpm --filter @urticketbuddy/<service>... build`.
   - Runs `pnpm prune --prod --no-optional` to strip `devDependencies`, leaving a lean production dependency footprint.

3. **Production Stage (`node:22-alpine`)**:
   - Sets `NODE_ENV=production`.
   - Installs `curl` for container health checks.
   - Drops root privileges and switches to non-root user `node` (`USER node`, UID 1000).
   - Copies only the pruned production `node_modules`, built packages, and application `dist/` artifacts.
   - Configures native Docker `HEALTHCHECK` probing `GET /api/v1/health`.

## Build Commands

From the monorepo root:

```bash
# Build API microservice
docker build -f apps/api/Dockerfile -t urticketbuddy-api:latest .

# Build Realtime microservice
docker build -f apps/realtime/Dockerfile -t urticketbuddy-realtime:latest .

# Build Worker microservice
docker build -f apps/worker/Dockerfile -t urticketbuddy-worker:latest .
```

## Security & Best Practices

- **Minimal Attack Surface**: Alpine Linux base with minimal runtime packages.
- **Least Privilege**: Runs exclusively as non-root `node` user.
- **Deterministic Builds**: Enforces `--frozen-lockfile` against `pnpm-lock.yaml`.
- **Health Checks**: Automated container lifecycle monitoring via `/api/v1/health`.
