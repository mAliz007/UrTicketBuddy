# @urticketbuddy/config

Shared configuration and environment variable loading for the UrTicketBuddy monorepo.

## Features

- **TypeScript Base Configs**: `tsconfig/base.json`, `tsconfig/node.json`, `tsconfig/react.json`
- **Linter & Formatter**: ESLint base and Prettier shared rules
- **Environment Loader**: Zod-based typed environment validation (`loadEnv`, `envSchema`)

## Environment Variables

All configuration is validated against `envSchema`. Refer to `.env.example` at the repository root.
