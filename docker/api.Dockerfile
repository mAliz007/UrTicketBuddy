# syntax=docker/dockerfile:1

# Stage 1: Dependency resolution and caching
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@12.21.0 --activate
WORKDIR /app

# Copy root workspace manifests for layer caching
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/db/package.json ./packages/db/
COPY packages/redis-scripts/package.json ./packages/redis-scripts/
COPY packages/venue-engine/package.json ./packages/venue-engine/
COPY apps/api/package.json ./apps/api/
COPY apps/realtime/package.json ./apps/realtime/
COPY apps/worker/package.json ./apps/worker/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# Stage 2: Build applications and shared packages
FROM deps AS build
WORKDIR /app

COPY tsconfig.json eslint.config.mjs ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm --filter @urticketbuddy/api... build

# Stage 3: Isolate production dependencies
FROM build AS prod-deps
WORKDIR /app

RUN pnpm --filter @urticketbuddy/api deploy --prod --prefer-offline /out/api

# Stage 4: Minimal production runtime image
FROM node:22-alpine AS production
RUN apk add --no-cache tini
WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts and production dependencies with non-root ownership
COPY --chown=node:node --from=prod-deps /out/api/dist ./dist
COPY --chown=node:node --from=prod-deps /out/api/node_modules ./node_modules
COPY --chown=node:node --from=prod-deps /out/api/package.json ./package.json

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:3000/api/v1/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
