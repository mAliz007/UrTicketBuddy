# Auth Module (`apps/api/src/modules/auth`)

## Overview

The `AuthModule` provides authentication, password hashing, and Role-Based Access Control (RBAC) for the UrTicketBuddy platform. It handles user registration, credential verification, JWT issuance (access and refresh tokens), Passport JWT validation, and RBAC guard enforcement.

## Components

### Endpoints

- **`POST /api/v1/auth/register`**:
  - Registers a new user with `{ email, password, firstName, lastName, role? }`.
  - Hashes passwords using `bcrypt` (10 rounds).
  - Persists the user record to PostgreSQL `users` table via `USER_REPOSITORY`.
  - Generates and returns a short-lived JWT `accessToken` (15m) and a long-lived `refreshToken` (7d).
- **`POST /api/v1/auth/login`**:
  - Authenticates credentials against the stored `passwordHash`.
  - Rejects unknown email or incorrect passwords with `401 Unauthorized` (`INVALID_CREDENTIALS`).
  - Generates and returns JWT `accessToken` and `refreshToken`.
- **`GET /api/v1/auth/me`**:
  - Protected endpoint returning the authenticated user's profile extracted from JWT bearer token.
- **`GET /api/v1/auth/admin-only`**:
  - RBAC verification endpoint protected by `@Roles(UserRole.ADMIN)`.

### Guards & Decorators

- **`JwtAuthGuard`**:
  - Validates incoming `Authorization: Bearer <token>` headers against `JWT_SECRET`.
  - Bypassed automatically when `@Public()` decorator is present.
- **`RolesGuard`**:
  - Compares the authenticated user's `role` against the roles declared via `@Roles(...)`.
  - Throws `403 Forbidden` (`FORBIDDEN`) if the user lacks the required role.
- **`@Public()`**:
  - Marks an endpoint as public, skipping JWT bearer validation.
- **`@Roles(...)`**:
  - Declares allowed roles (`CUSTOMER`, `ORGANIZER`, `ADMIN`) on route handlers or controllers.
- **`@CurrentUser()`**:
  - Parameter decorator resolving `request.user`.

## Data Model & Migration

Backed by PostgreSQL table `users` created in migration `1794837000000-UTB-3-init-users.ts`:

- `id`: UUID Primary Key (`gen_random_uuid()`)
- `email`: VARCHAR(255) UNIQUE with covering index `idx_users_email`
- `passwordHash`: VARCHAR(255)
- `firstName`: VARCHAR(100)
- `lastName`: VARCHAR(100)
- `role`: VARCHAR(20) DEFAULT `'CUSTOMER'` with covering index `idx_users_role`
- `createdAt`: TIMESTAMP WITH TIME ZONE
- `updatedAt`: TIMESTAMP WITH TIME ZONE
