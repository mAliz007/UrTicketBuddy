# ==========================================
# Multi-Stage Production Dockerfile for apps/api
# ==========================================

# Stage 1: Builder
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable && corepack prepare pnpm@12.21.0 --activate

WORKDIR /app

# Copy root workspace manifests
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./

# Copy internal packages and target app source
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Build Stage
RUN pnpm --filter @urticketbuddy/api... build

# Strip devDependencies to produce lean production dependencies
RUN pnpm prune --prod --no-optional

# Stage 3: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl for health checks
RUN apk add --no-cache curl

# Configure secure non-root permissions
USER node

# Copy production artifacts and pruned dependencies
COPY --chown=node:node --from=builder /app/package.json ./package.json
COPY --chown=node:node --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

CMD ["node", "apps/api/dist/main"]
