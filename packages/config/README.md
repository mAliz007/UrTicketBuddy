# @urticketbuddy/config

Shared configuration and environment variable loading for the UrTicketBuddy monorepo.

## Features

- **TypeScript Base Configs**: `tsconfig/base.json`, `tsconfig/node.json`, `tsconfig/react.json`
- **Linter & Formatter**: ESLint flat config and Prettier shared rules
- **Environment Loader**: Zod-based typed environment validation (`loadEnv`, `envSchema`)
- **Automated Validation Suite**: Jest validation for Dockerfiles, Compose specs, and CD workflows (`docker-cd.spec.ts`)

---

## Environment Validation & Production Safety Rules

All configuration is parsed and validated at process startup through `loadEnv()` using Zod schemas:

### Critical Production Refinements

```typescript
.refine(
  (data) => {
    if (data.NODE_ENV === "production") {
      return (
        data.MASTER_TICKET_SECRET !== "dev-master-ticket-secret-32-chars-long-key"
      );
    }
    return true;
  },
  {
    message: "Production deployment must set a unique, non-default MASTER_TICKET_SECRET in environment",
    path: ["MASTER_TICKET_SECRET"],
  }
)
```

> [!IMPORTANT]
> When `NODE_ENV=production`, `MASTER_TICKET_SECRET` **must** be a unique, cryptographically random key ($\ge 32$ characters). Using the dev placeholder triggers an immediate process crash on startup.
>
> To generate a valid production key:
>
> ```bash
> openssl rand -hex 32
> ```
>
> The CI/CD pipeline ([`.github/workflows/cd.yml`](../../.github/workflows/cd.yml)) automatically injects a generated 64-hex key during host bootstrapping if not already provided.

---

## Core Variables Overview

Refer to [`.env.example`](../../.env.example) at the repository root for all available keys and defaults:

| Variable               | Default (Dev)                             | Description                                                  |
| :--------------------- | :---------------------------------------- | :----------------------------------------------------------- |
| `NODE_ENV`             | `development`                             | Environment mode (`development`, `production`, `test`)       |
| `API_PORT`             | `3000`                                    | Port for NestJS REST API                                     |
| `REALTIME_PORT`        | `3001`                                    | Port for Socket.io WebSocket Gateway                         |
| `WORKER_PORT`          | `3002`                                    | Port for BullMQ standalone worker                            |
| `POSTGRES_PORT`        | `6432`                                    | Applications connect to Postgres via **PgBouncer** on 6432   |
| `MONGO_URI`            | `mongodb://localhost:27017/urticketbuddy` | MongoDB layout database                                      |
| `REDIS_PORT`           | `6379`                                    | Redis Stack server port                                      |
| `MASTER_TICKET_SECRET` | _32-char dev key_                         | HMAC base key for time-decaying dynamic QR ticket generation |
| `JWT_SECRET`           | _16-char dev key_                         | Access token signing secret                                  |
| `JWT_REFRESH_SECRET`   | _16-char dev key_                         | Refresh token signing secret                                 |
