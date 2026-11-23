# 2. Oracle Cloud Always Free Deployment Architecture (ADR-0002)

## Status

Accepted (Amends and supersedes D-5 from ADR-0001)

## Context

In ADR-0001 (Decision D-5), live deployment was initially targeted for Railway. However, UrTicketBuddy's full backend architecture encompasses three distinct Node/NestJS microservices (`apps/api`, `apps/realtime`, `apps/worker`), transactional PostgreSQL with PgBouncer, MongoDB for venue layout persistence, and Redis Stack with RedisBloom for high-throughput concurrency locks and pub/sub messaging.

Railway's resource constraints and pricing model pose critical challenges for an end-to-end multi-container deployment:

1. Railway free/trial credits are time-capped and insufficient to sustain five persistent services plus backing databases without sleep limits or unexpected shutdowns.
2. Segmenting services across multiple disparate free-tier providers (e.g. Render for web, Upstash for Redis, Neon for Postgres) introduces 30–80ms of network overhead across the public internet. This severely degrades UrTicketBuddy's sub-millisecond atomic seat lock requirements (`hold_seats.lua`, `confirm_sold.lua`) and drops live WebSocket connections.

## Decision

We update **Decision D-5** to adopt **Oracle Cloud Infrastructure (OCI) Always Free Tier** as the primary live deployment target:

1. **Host Shape**: Single virtual machine running on OCI Ampere A1 Compute (`VM.Standard.A1.Flex`) with:
   - 4 OCPUs (ARM64 architecture)
   - 24 GB of RAM
   - 200 GB of free NVMe-backed block storage
   - Static public IPv4 address and automated firewall/security list rules.
2. **Containerized Co-Location**:
   - The entire production stack (`apps/api`, `apps/realtime`, `apps/worker`, `postgres` + `pgbouncer`, `redis` + `redisbloom`, `mongo`, and `nginx` reverse proxy with Let's Encrypt SSL) will run containerized via `docker-compose.prod.yml` directly on the OCI instance.
   - Intra-service communications operate over an internal Docker bridge network, guaranteeing $< 0.1$ms latency between the API, worker, Redis, and databases.
3. **Continuous Deployment (CD)**:
   - GitHub Actions workflow (`.github/workflows/cd.yml`) triggers on push to `main` after CI checks pass.
   - Images are built with multi-platform support (`linux/arm64`, `linux/amd64`) and pushed to GitHub Container Registry (`ghcr.io`).
   - The CD runner securely SSHs into the OCI VM, pulls updated images, applies migrations, and executes zero-downtime rolling container restarts with automated health check verification on `/api/v1/health`.
4. **Kubernetes Portability**:
   - Kubernetes manifests remain validated via local `kind` clusters and are deployable onto lightweight K3s on OCI if cluster orchestration is desired.

## Consequences

- **Cost**: $0.00/month recurring cost with generous resource headroom (24 GB RAM, 4 vCPUs).
- **Performance**: Ultra-low latency for atomic Redis locks, persistent WebSockets, and continuous background worker execution without sleep states.
- **Portability**: Production multi-stage Dockerfiles remain 100% container-standard and portable to AWS, GCP, Railway, or bare-metal Kubernetes at any time.
