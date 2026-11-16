FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@12.21.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json ./
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @urticketbuddy/worker build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3002
CMD ["node", "apps/worker/dist/main"]
