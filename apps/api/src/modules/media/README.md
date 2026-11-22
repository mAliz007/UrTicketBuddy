# Media Upload & Object Storage Module

The **Media Module** provides secure, signed object-storage upload URL generation, pre-signed upload handling, and CDN-cached media retrieval for UrTicketBuddy.

## Capabilities

1. **Pre-signed Object Storage Upload URLs (`POST /api/v1/media/upload-url`)**:
   - Generates pre-signed `PUT` URLs for direct client-to-storage uploads.
   - Supports **AWS S3**, **Oracle Cloud Infrastructure (OCI) Object Storage** (S3-compatible API), and **Local Storage** simulator for local/test development.
   - Cryptographic AWS SigV4 implementation with zero heavy external dependencies.
   - Enforces strict MIME type whitelisting (`image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`, `application/pdf`).
   - Enforces strict 10MB maximum file size limit.
   - Sanitizes filenames against path traversal attacks (`..`).

2. **Direct Local Upload Receiver (`PUT /api/v1/media/upload/:purpose/:filename`)**:
   - Accepts binary stream direct PUT uploads when `STORAGE_PROVIDER=local`.
   - Validates cryptographic HMAC-SHA256 signature token and expiration timestamp.
   - Prevents unauthorized uploads and arbitrary filesystem writes.

3. **Public CDN Media Delivery (`GET /api/v1/media/:purpose/:filename`)**:
   - Serves public media assets (event banners, venue layouts, avatars) with edge CDN caching headers:
     - `Cache-Control: public, max-age=86400, stale-while-revalidate=3600`
     - MD5 content-based `ETag` and conditional request handling (`If-None-Match` -> `HTTP 304 Not Modified`)
     - `X-Cache-Status: HIT-LOCAL-ORIGIN`
     - Security header `X-Content-Type-Options: nosniff`

## Nginx CDN Edge Integration

`infra/nginx/nginx.conf` proxies media requests through the `media_cache` zone:

- 24-hour cache TTL for successful 200/302 responses.
- Stale-while-revalidate and cache locking (`proxy_cache_lock on`) preventing cache stampedes.
- Microcaching on high-traffic public read routes (`/api/v1/events`, `/api/v1/venues`).

## Configuration

| Variable               | Default                       | Description             |
| ---------------------- | ----------------------------- | ----------------------- |
| `STORAGE_PROVIDER`     | `local`                       | `local`, `s3`, or `oci` |
| `S3_BUCKET`            | `urticketbuddy-media`         | Target bucket name      |
| `S3_REGION`            | `us-east-1`                   | S3 / OCI region         |
| `S3_ENDPOINT`          | None                          | Custom S3/OCI endpoint  |
| `S3_ACCESS_KEY_ID`     | None                          | Storage access key      |
| `S3_SECRET_ACCESS_KEY` | None                          | Storage secret key      |
| `CDN_BASE_URL`         | `http://localhost:3000/media` | Public CDN base URL     |
