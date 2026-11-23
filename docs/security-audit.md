# UrTicketBuddy Security Audit & Hardening Report

## Executive Summary

This security audit and production hardening document details the security posture, defensive architectures, route authorization matrices, and OWASP Top 10 mitigations for **UrTicketBuddy**.

UrTicketBuddy is a high-concurrency event ticketing platform handling sensitive payments, cryptographic dynamic QR ticket generation, atomic seat reservation locks, and peer-to-peer ticket resale. This report demonstrates zero-trust defense-in-depth across the network edge, API gateway, microservice runtime, data stores, and CI/CD supply chain.

---

## 1. OWASP Top 10 (2021) Mapping Matrix

| OWASP Category                                            | Vulnerability Description                                                                                    | UrTicketBuddy Implementation / Guard / Script                                                                                                                                                                                                                                                                                                                                                                                                                  | Repository Passing Test Case                                                                                                                                                                                                                                                                                                      |
| :-------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A01:2021 — Broken Access Control**                      | Unauthorized privilege escalation, missing function-level access control, cross-tenant data leakage.         | `apps/api/src/modules/auth/guards/jwt-auth.guard.ts`<br>`apps/api/src/modules/auth/guards/roles.guard.ts`<br>`apps/api/src/common/guards/ownership.guard.ts`<br>`apps/api/src/modules/tickets/tickets.service.ts`<br>`apps/api/src/modules/analytics/analytics.service.ts`<br>`apps/api/src/database/database.module.ts` (Append-only proxy)                                                                                                                   | `apps/api/test/security-audit.e2e-spec.ts` (`Route Metadata Audit Scanner`, `Role × Route Authorization Matrix`, `Organizer Cross-Tenant Isolation`)<br>`apps/api/test/auth.e2e-spec.ts`<br>`apps/api/test/admin-analytics.e2e-spec.ts`                                                                                           |
| **A02:2021 — Cryptographic Failures**                     | Cleartext sensitive data exposure, weak cryptographic algorithms, ticket counterfeiting, credential leakage. | `apps/api/src/modules/tickets/tickets.service.ts` (Decision D-3 HKDF + HMAC-SHA256 dynamic QR token generation)<br>`apps/api/src/modules/auth/auth.service.ts` (bcrypt salted password hashing, SHA-256 refresh token hashing)<br>`packages/config/src/env.ts` (Zod validation enforcing 32+ char `MASTER_TICKET_SECRET`)<br>`apps/api/src/common/interceptors/log-redaction.interceptor.ts`                                                                   | `apps/api/test/security-audit.e2e-spec.ts` (`Ticket Owner CUSTOMER -> 200 OK with HMAC token`, `Sensitive Field Log Redaction Matrix`)<br>`apps/api/test/tickets-gate.e2e-spec.ts` (Constant-time `timingSafeEqual` HMAC verification & replay rejection)<br>`apps/api/src/common/interceptors/log-redaction.interceptor.spec.ts` |
| **A03:2021 — Injection**                                  | SQL/NoSQL injection, command injection, malformed request payloads.                                          | TypeORM parameterized queries & entities (`packages/db/src/entities/`)<br>Zod request validation schemas with `.strict()` (`packages/contracts/src/`)<br>Pure parameterized Redis Lua scripts (`packages/redis-scripts/lua/*.lua`)<br>`apps/api/src/main.ts` (`helmet`, body-parser 100kb limit)                                                                                                                                                               | `packages/contracts/src/index.spec.ts` (Strict schema rejects unknown/malicious fields)<br>`packages/redis-scripts/test/*.spec.ts` (Lua script isolation and atomicity)<br>`packages/db/src/data-check.spec.ts` (Schema and constraint integrity)                                                                                 |
| **A04:2021 — Insecure Design**                            | Race conditions during ticket sales, scalp-gouging resale abuse, replay attacks, seat hold starvation.       | Redis + Lua atomic seat locking with TTL 600 (`packages/redis-scripts/lua/hold_seats.lua`)<br>Capped P2P resale at 110% face value minor (`packages/contracts/src/resale.ts`, `apps/api/src/modules/resale/resale.service.ts`)<br>Event start lock prohibiting post-start secondary sales<br>Compensating refund transactions on ledger failures<br>Bloom filter ticket membership pre-check (`apps/api/src/common/bloom/`)                                    | `apps/api/test/resale.e2e-spec.ts` (Resale 110% cap, event start check, compensating refund, idempotency)<br>`apps/api/test/checkout-hold.e2e-spec.ts` (Atomic seat hold race tests)<br>`apps/worker/test/expiry.integration.spec.ts` (Hold expiry release worker)                                                                |
| **A05:2021 — Security Misconfiguration**                  | Missing HTTP security headers, permissive CORS, unchecked error stack traces, unindexed tables.              | `apps/api/src/main.ts` (`helmet()` headers: `X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, `Referrer-Policy`)<br>Strict CORS origin allowlist loaded from `CORS_ORIGINS`<br>`infra/nginx/nginx.conf` (`limit_req_zone`, `add_header` security options)<br>`packages/db/src/data-source.ts` (`synchronize: false` enforced everywhere)<br>`apps/api/src/common/filters/http-exception.filter.ts` (Redacts internal exceptions into clean error envelopes) | `packages/db/src/check.ts` / `pnpm db:check` (Validates `synchronize: false`, primary keys, and foreign key indexes)<br>`apps/api/src/common/filters/http-exception.filter.spec.ts` (Error envelope & 429 formatting)                                                                                                             |
| **A06:2021 — Vulnerable and Outdated Components**         | Exploitable third-party dependencies in supply chain.                                                        | `.github/workflows/ci.yml` & `.github/workflows/security.yml` (Automated `pnpm audit --audit-level=high`)<br>Strict package pinning in `pnpm-lock.yaml` with frozen lockfile deployment<br>Secret and private key scanner in CI pipeline                                                                                                                                                                                                                       | GitHub Actions CI security workflows (`ci.yml`, `security.yml`)                                                                                                                                                                                                                                                                   |
| **A07:2021 — Identification and Authentication Failures** | Credential stuffing, brute force login, session fixation, token theft/replay.                                | Dual-token auth architecture: 15-minute JWT access tokens + rotating 7-day refresh tokens<br>Token family tracking with reuse detection that instantly revokes all descended tokens (`apps/api/src/modules/auth/auth.service.ts`)<br>NestJS Throttler `@Throttle({ default: { limit: 5, ttl: 60000 } })` on `/api/v1/auth/login`<br>Nginx edge throttling `auth_limit:10m rate=5r/s`<br>Account suspension verification on all auth checks                     | `apps/api/test/security-audit.e2e-spec.ts` (`Refresh Token Rotation & Family Reuse Revocation`)<br>`apps/api/test/auth.e2e-spec.ts` (Brute-force rate limiting and refresh token rotation)                                                                                                                                        |
| **A08:2021 — Software and Data Integrity Failures**       | Forged QR tickets, unverified webhooks, untrusted deserialization, schema drift.                             | Decision D-3 Dynamic QR HMAC signature verification (`apps/api/src/modules/tickets/tickets.service.ts`)<br>30-second rotating decay window with clock skew tolerance (+/- 1 window)<br>`seedVersion` invalidation on ticket transfer or fraud revocation<br>Stripe/Safepay webhook signature validation<br>Automated database migration checking (`pnpm db:check`, `pnpm db:check:data`)                                                                       | `apps/api/test/tickets-gate.e2e-spec.ts` (Dynamic QR HMAC verification, forged ticket rejection, used ticket lock)<br>`packages/db/src/data-check.spec.ts` (Nightly database integrity and orphan detection)                                                                                                                      |
| **A09:2021 — Security Logging and Monitoring Failures**   | Credential leaks in logs, missing administrative audit trails, tamperable logs.                              | Immutable append-only audit log table (`audit_logs`) enforced by TypeORM Proxy interceptor in `DatabaseModule`<br>`apps/api/src/common/interceptors/log-redaction.interceptor.ts` (Scans and redacts `password`, `passwordHash`, `accessToken`, `refreshToken`, `Authorization`, `Cookie`, `token`, `qrToken`, `qrPayload`, `secret`, `seed`, `hmac`)<br>`AuditLogInterceptor` capturing actor, action, IP, and entity diffs                                   | `apps/api/src/common/interceptors/log-redaction.interceptor.spec.ts` (Sensitive field redaction tests)<br>`apps/api/test/admin-analytics.e2e-spec.ts` (Append-only immutability tests)<br>`apps/api/test/security-audit.e2e-spec.ts` (Sensitive Field Log Redaction Matrix)                                                       |
| **A10:2021 — Server-Side Request Forgery (SSRF)**         | Arbitrary outbound server requests, cloud metadata exfiltration.                                             | Pre-signed S3/OCI upload URL generation with strict key prefixing and content-type boundaries (`apps/api/src/modules/media/`)<br>Isolated internal network routing in Docker and Kubernetes<br>Explicit webhook endpoint provider mapping                                                                                                                                                                                                                      | `apps/api/src/modules/media/media.service.spec.ts` (Signed URL boundary enforcement)<br>`apps/api/test/security-audit.e2e-spec.ts` (Upload URL role authorization)                                                                                                                                                                |

---

## 2. Route Table Authorization Matrix

The table below reflects the automated route authorization matrix verified programmatically in `apps/api/test/security-audit.e2e-spec.ts`:

| Route Path                             | HTTP Method   | Public / Guard                                 | Permitted Roles                                | Expected Unauthorized / Forbidden Behavior                       |
| :------------------------------------- | :------------ | :--------------------------------------------- | :--------------------------------------------- | :--------------------------------------------------------------- |
| `/api/v1/health`                       | `GET`         | `@Public()`                                    | All / Anonymous                                | `200 OK`                                                         |
| `/api/v1/auth/register`                | `POST`        | `@Public()`                                    | All / Anonymous                                | `201 CREATED`                                                    |
| `/api/v1/auth/login`                   | `POST`        | `@Public()`                                    | All / Anonymous                                | Throttled (5 req/min), `200 OK` on valid credentials             |
| `/api/v1/auth/refresh`                 | `POST`        | `@Public()`                                    | All / Anonymous                                | `401 INVALID_REFRESH_TOKEN` on expired/reused token              |
| `/api/v1/auth/logout`                  | `POST`        | `@Public()`                                    | All / Anonymous                                | `200 OK`                                                         |
| `/api/v1/auth/me`                      | `GET`         | `JwtAuthGuard`                                 | `CUSTOMER`, `GATE_STAFF`, `ORGANIZER`, `ADMIN` | `401 UNAUTHORIZED` if unauthenticated                            |
| `/api/v1/auth/admin-only`              | `GET`         | `JwtAuthGuard`, `RolesGuard`                   | `ADMIN`                                        | `401 UNAUTHORIZED` (anon), `403 FORBIDDEN` (others)              |
| `/api/v1/organizer/gate-staff`         | `POST`        | `JwtAuthGuard`, `RolesGuard`                   | `ORGANIZER`, `ADMIN`                           | `401 UNAUTHORIZED` (anon), `403 FORBIDDEN` (CUSTOMER/GATE_STAFF) |
| `/api/v1/users/me/profile`             | `GET`, `PUT`  | `JwtAuthGuard`                                 | `CUSTOMER`, `GATE_STAFF`, `ORGANIZER`, `ADMIN` | `401 UNAUTHORIZED` if unauthenticated                            |
| `/api/v1/users/me/tickets`             | `GET`         | `JwtAuthGuard`                                 | `CUSTOMER`, `ADMIN`                            | `401 UNAUTHORIZED` if unauthenticated                            |
| `/api/v1/venues`                       | `GET`, `POST` | `@Public()`                                    | All / Anonymous                                | Validates Zod layout schema                                      |
| `/api/v1/events`                       | `GET`, `POST` | `@Public()`                                    | All / Anonymous                                | Public discovery                                                 |
| `/api/v1/checkout/hold`                | `POST`        | `@Public()` (Header check)                     | Users with `x-user-id`                         | `401 UNAUTHORIZED` if `x-user-id` header missing                 |
| `/api/v1/orders/checkout`              | `POST`        | `@Public()`                                    | All authenticated or guest users               | Validates idempotency key & payment intent                       |
| `/api/v1/tickets/:id/dynamic-qr`       | `GET`         | `JwtAuthGuard`, `RolesGuard`                   | Ticket Owner `CUSTOMER`, `ADMIN`               | `401 UNAUTHORIZED` (anon), `403 FORBIDDEN` (non-owner)           |
| `/api/v1/tickets/:id/rotate-key`       | `PATCH`       | `JwtAuthGuard`, `RolesGuard`                   | `ADMIN`                                        | `401 UNAUTHORIZED` (anon), `403 FORBIDDEN` (CUSTOMER/ORGANIZER)  |
| `/api/v1/gate/scan`                    | `POST`        | `JwtAuthGuard`, `RolesGuard`                   | `GATE_STAFF`, `ORGANIZER`, `ADMIN`             | `401 UNAUTHORIZED` (anon), `403 FORBIDDEN` (CUSTOMER)            |
| `/api/v1/resale/listings`              | `GET`         | `@Public()`                                    | All / Anonymous                                | Public secondary ticket browse                                   |
| `/api/v1/resale/listings`              | `POST`        | `JwtAuthGuard`, `RolesGuard`                   | Ticket Owner `CUSTOMER`, `ADMIN`               | `401 UNAUTHORIZED` (anon), `403 FORBIDDEN` (non-owner)           |
| `/api/v1/resale/listings/:id/purchase` | `POST`        | `JwtAuthGuard`, `RolesGuard`                   | `CUSTOMER`, `ORGANIZER`, `ADMIN`               | `401 UNAUTHORIZED` (anon), `409 CONFLICT` (seller self-buy)      |
| `/api/v1/admin/audit-logs`             | `GET`         | `JwtAuthGuard`, `RolesGuard`                   | `ADMIN`                                        | `401 UNAUTHORIZED` (anon), `403 FORBIDDEN` (CUSTOMER/ORGANIZER)  |
| `/api/v1/admin/settings/commission`    | `GET`, `PUT`  | `JwtAuthGuard`, `RolesGuard`                   | `ADMIN`                                        | `401 UNAUTHORIZED` (anon), `403 FORBIDDEN` (CUSTOMER/ORGANIZER)  |
| `/api/v1/admin/users/:id/suspend`      | `PATCH`       | `JwtAuthGuard`, `RolesGuard`                   | `ADMIN`                                        | `401 UNAUTHORIZED` (anon), `403 FORBIDDEN` (CUSTOMER/ORGANIZER)  |
| `/api/v1/organizer/analytics/:eventId` | `GET`         | `JwtAuthGuard`, `RolesGuard`, `OwnershipGuard` | Event Owner `ORGANIZER`, `ADMIN`               | `401 UNAUTHORIZED` (anon), `403 FORBIDDEN` (wrong organizer)     |
| `/api/v1/media/upload-url`             | `POST`        | `JwtAuthGuard`, `RolesGuard`                   | `CUSTOMER`, `ORGANIZER`, `ADMIN`               | `401 UNAUTHORIZED` (anon)                                        |
| `/api/v1/media/upload/:fileKey`        | `PUT`         | `@Public()`                                    | Signed token holders                           | Validates HMAC signature on upload payload                       |

---

## 3. Cryptographic Token Specification (Decision D-3)

Dynamic QR tokens prevent ticket duplication, static screenshot scalping, and fraudulent resale.

```
+-----------------------------------------------------------------------------+
|                          HKDF-SHA256 Key Derivation                        |
|                                                                             |
|  MASTER_TICKET_SECRET (32+ bytes)                                           |
|          +                                                                  |
|  ticketId + ":" + seedVersion (Info context)                                |
|          v                                                                  |
|  Derived Ticket Secret (32 bytes Buffer)                                    |
+-----------------------------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------------------------+
|                      Time-Decaying HMAC-SHA256 Token                        |
|                                                                             |
|  currentWindow = floor(currentTimestampMs / 1000 / 30)                      |
|  HMAC = HMAC-SHA256(DerivedKey, ticketId + ":" + currentWindow)             |
|                                                                             |
|  Token Payload = base64url( ticketId + "." + currentWindow + "." + HMAC )   |
|  ExpiresAt     = ISO8601( (currentWindow + 1) * 30 * 1000 )                 |
+-----------------------------------------------------------------------------+
```

### Verification & Replay Protection Properties:

1. **Window Drift Tolerance**: Gate turnstile verification strictly accepts `currentWindow` and `currentWindow - 1` (30–60 second maximum tolerance) to accommodate physical network jitter.
2. **Instant Invalidation on Transfer**: When a ticket is resold or transferred, `seedVersion` is incremented (`seedVersion += 1`). All existing derived keys and active tokens instantly fail validation.
3. **Atomic Scan Nonce Locking**: Scans execute atomic Redis lock: `SET qr_nonce:<ticketId>:<window> 1 NX EX 60`. If the same QR is scanned twice within the valid window, the second attempt is rejected immediately before hitting Postgres.
4. **Bloom Filter Prefilter**: Before database lookups, RedisBloom (`bf:tickets`) verifies that the ticket ID exists in O(1) time without DB load.

---

## 4. Multi-Layer Rate Limiting & DoS Defense

Rate limiting is enforced at both the Nginx edge reverse proxy and the NestJS application layer:

### Edge Rate Limiting (`infra/nginx/nginx.conf`):

- `limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;` (General API, burst=20)
- `limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/s;` (Auth endpoints, burst=10)
- `limit_req_zone $binary_remote_addr zone=checkout_limit:10m rate=10r/s;` (Hold & checkout, burst=15)
- `limit_req_zone $binary_remote_addr zone=orders_limit:10m rate=10r/s;` (Order endpoints, burst=20)
- `limit_req_zone $binary_remote_addr zone=gate_scan_limit:10m rate=30r/s;` (High-throughput turnstiles, burst=50)
- `limit_req_zone $binary_remote_addr zone=resale_limit:10m rate=10r/s;` (Secondary listings & purchase, burst=20)
- `limit_req_status 429;` (RFC 6585 compliance)

### Application Rate Limiting & Error Mapping (`apps/api`):

- NestJS `@Throttle({ default: { limit: 5, ttl: 60000 } })` applied to `/api/v1/auth/login`.
- `GlobalHttpExceptionFilter` intercepts all `ThrottlerException` and HTTP 429 instances, emitting:
  ```json
  {
    "error": {
      "code": "TOO_MANY_REQUESTS",
      "message": "Too many requests",
      "requestId": "req-xxx"
    }
  }
  ```
- Automatically sets the HTTP header `Retry-After: 60`.

---

## 5. Log Redaction & Data Privacy (`LogRedactionInterceptor`)

All incoming and outgoing request metadata is filtered through `LogRedactionInterceptor` before reaching stdout or disk logs.

### Scrubbed Field Patterns:

- `password`, `passwordHash`
- `accessToken`, `refreshToken`, `token`
- `authorization` (HTTP Authorization header)
- `cookie` (HTTP Cookie header, session cookies)
- `qrToken`, `qrPayload` (Dynamic QR payloads)
- `secret`, `masterSecret`, `clientSecret`
- `hmac`, `seed`, `key`

### Output Guarantee:

Sensitive string values are irreversibly replaced with `"[REDACTED]"`. Date objects, numbers, and non-sensitive attributes (`email`, `eventId`, `ticketId`) remain readable for monitoring and analytics.

---

## 6. Tenant Isolation Architecture (`OwnershipGuard`)

UrTicketBuddy enforces multi-tenant boundaries separating independent event organizers:

```
[ Incoming Request ]
         |
         v
[ JwtAuthGuard: Validate Signature & Expiry ]
         |
         v
[ RolesGuard: Check Role (ORGANIZER, ADMIN, etc.) ]
         |
         v
[ OwnershipGuard: Tenant Isolation Barrier ]
    |
    +---> Role is ADMIN?  --> [ ALLOW (Global Bypass) ]
    |
    +---> Role is ORGANIZER?
            |
            +--> Does target organizerTenantId match user's tenantId?
                   |
                   +-- YES --> [ ALLOW ]
                   |
                   +-- NO  --> [ THROW 403 FORBIDDEN: Cross-tenant access forbidden ]
```

---

## 7. CI Supply-Chain Security & Automated Audit Gates

The continuous integration pipeline (`.github/workflows/ci.yml` and `.github/workflows/security.yml`) executes automated security gates on every push and pull request:

1. **Supply-Chain Dependency Audit**:
   `pnpm audit --audit-level=high` checks npm advisories across all workspace packages.
2. **Secret Leak & Private Key Scanner**:
   Regex scanner searches the repository for exposed PEM private keys (`BEGIN RSA/EC PRIVATE KEY`) or hardcoded production secrets.
3. **Automated Route Table Scanner & Matrix Suite**:
   Runs `apps/api/test/security-audit.e2e-spec.ts` ensuring that every registered NestJS route is guarded and that the role matrix passes 100%.
4. **Database Migration Consistency Gate**:
   `pnpm db:check` verifies that `synchronize: false` is honored, all primary keys exist, and all foreign key columns have covering indexes.
