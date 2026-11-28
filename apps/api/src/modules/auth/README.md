# Auth Module (`apps/api/src/modules/auth`)

## Overview

The `AuthModule` provides authentication, password hashing, token rotation, and Role-Based Access Control (RBAC) for the UrTicketBuddy platform. It handles user registration, credential verification, JWT issuance, secure refresh cookie management, rotation with family-wide reuse detection, Passport JWT and Google OAuth strategies, gate staff provisioning, and RBAC / ownership guard enforcement.

## Components

### Endpoints

- **`POST /api/v1/auth/register`**:
  - Registers a new `CUSTOMER` user with `{ email, password, firstName, lastName }`. Client-supplied `role` fields are rejected with `422 Unprocessable Entity` (`VALIDATION_ERROR`).
  - Hashes passwords using `bcrypt` (10 rounds).
  - Persists the user record to PostgreSQL `users` table via `USER_REPOSITORY`.
  - Generates and returns short-lived JWT `accessToken` (15m) and sets `httpOnly`, `Secure`, `SameSite: strict` refresh token cookie.
- **`POST /api/v1/auth/login`**:
  - Authenticates credentials against the stored `passwordHash`.
  - Protected by rate limiter `@Throttle({ default: { limit: 5, ttl: 60000 } })`.
  - Rejects unknown email or incorrect passwords with `401 Unauthorized` (`INVALID_CREDENTIALS`).
  - Generates and returns JWT `accessToken` and sets secure refresh token cookie.
- **`POST /api/v1/auth/refresh`**:
  - Accepts refresh token via secure cookie or request body.
  - Verifies token against `refresh_tokens` database table.
  - Implements cryptographic token rotation with `jti: crypto.randomUUID()`.
  - Enforces reuse detection: if a revoked token is replayed, the entire token family (`familyId`) is immediately revoked with `401 Unauthorized` (`INVALID_REFRESH_TOKEN`).
- **`POST /api/v1/auth/logout`**:
  - Revokes current refresh token in database and clears the refresh cookie.
- **`GET /api/v1/auth/google` & `GET /api/v1/auth/google/callback`**:
  - Google OAuth 2.0 flow via Passport. Matches accounts securely by verified email.
- **`GET /api/v1/auth/me`**:
  - Protected endpoint returning the authenticated user's profile extracted from JWT bearer token.
- **`GET /api/v1/auth/admin-only`**:
  - RBAC verification endpoint protected by `@Roles(UserRole.ADMIN)`.
- **`POST /api/v1/organizer/gate-staff`**:
  - Protected by `@Roles(UserRole.ORGANIZER, UserRole.ADMIN)`.
  - Provisions scanner accounts with `GATE_STAFF` role bound to organizer's `organizerTenantId`.
- **`GET /api/v1/users/me/profile` & `PUT /api/v1/users/me/profile`**:
  - Profile retrieval and update endpoints for authenticated users.

### Guards & Decorators

- **`JwtAuthGuard`**:
  - Registered globally as an `APP_GUARD` in `AuthModule` to enforce JWT authentication across all `apps/api` routes by default.
  - Validates incoming `Authorization: Bearer <token>` headers against `JWT_SECRET` and populates `request.user` (`id`, `email`, `role`, `organizerTenantId`) via `JwtStrategy.validate`.
  - Bypassed automatically when `@Public()` decorator is present.
- **`RolesGuard`**:
  - Registered globally as an `APP_GUARD` after `JwtAuthGuard`.
  - Compares authenticated user's `role` against roles declared via `@Roles(...)`.
  - Throws `403 Forbidden` (`FORBIDDEN`) if the user lacks the required role.
- **`OwnershipGuard`**:
  - Validates tenant resource ownership against organizer's `organizerTenantId` (including venue/event lookup checks). `ADMIN` bypasses.
- **`@Public()`**:
  - Marks an endpoint as public, skipping JWT bearer validation.
- **`@Roles(...)`**:
  - Declares allowed roles (`CUSTOMER`, `ORGANIZER`, `ADMIN`, `GATE_STAFF`) on route handlers or controllers.
- **`@CurrentUser()`**:
  - Parameter decorator resolving `request.user`.

## Data Model & Migrations

Backed by PostgreSQL tables created in migrations:

1. `1794837000000-UTB-3-init-users.ts`:
   - `id`: UUID Primary Key (`gen_random_uuid()`)
   - `email`: VARCHAR(255) UNIQUE with covering index `idx_users_email`
   - `passwordHash`: VARCHAR(255)
   - `firstName`: VARCHAR(100)
   - `lastName`: VARCHAR(100)
   - `role`: VARCHAR(20) DEFAULT `'CUSTOMER'` with covering index `idx_users_role`
   - `createdAt`: TIMESTAMP WITH TIME ZONE
   - `updatedAt`: TIMESTAMP WITH TIME ZONE
2. `1794837100000-UTB-3-init-refresh-tokens.ts`:
   - Adds `organizerTenantId` column to `users` with index `idx_users_organizer_tenant_id`
   - Creates `refresh_tokens` table:
     - `id`: UUID Primary Key
     - `userId`: UUID with covering index `idx_refresh_tokens_user_id`
     - `tokenHash`: VARCHAR(64) UNIQUE with index `idx_refresh_tokens_token_hash`
     - `familyId`: UUID with index `idx_refresh_tokens_family_id`
     - `isRevoked`: BOOLEAN DEFAULT false
     - `expiresAt`: TIMESTAMP WITH TIME ZONE
     - `createdAt`, `updatedAt`: TIMESTAMP WITH TIME ZONE
