# Infrastructure (`infra/`)

Infrastructure, container orchestration, reverse proxy configurations, and automated deployment automation.

## Live Production Deployment

UrTicketBuddy is deployed and verified on **Oracle Cloud Infrastructure (OCI) Always Free Tier** (ADR-0002):

- **Host IP**: `129.221.182.252` (Ubuntu host, 4GB NVMe swap space, Docker Engine 28+)
- **Web SPA**: [http://129.221.182.252/](http://129.221.182.252/)
- **Unified Health**: [http://129.221.182.252/health](http://129.221.182.252/health)
- **REST API**: [http://129.221.182.252/api/v1/health](http://129.221.182.252/api/v1/health)
- **WebSockets**: `ws://129.221.182.252/socket.io/`
- **Proxy Health**: [http://129.221.182.252/healthz](http://129.221.182.252/healthz)

---

## Directory Structure

- `docker/`: Dockerfile configurations and service setup (e.g. `pgbouncer/`, `Dockerfile.web`, etc.)
- `nginx/`: Nginx reverse proxy configuration (`nginx.conf`) with rate limiting, gzip, and SPA fallback routing
- `k8s/`: Kubernetes manifests (validated on Kind)
- `loadtests/`: k6 load testing scenarios
- `scripts/`: Host bootstrap (`setup-oracle-vm.sh`) and database maintenance scripts

---

## Production Services & Port Matrix

| Service           | Container Name           |  Host Port  | Internal Port | Healthcheck          | Role                                                                           |
| :---------------- | :----------------------- | :---------: | :-----------: | :------------------- | :----------------------------------------------------------------------------- |
| **Nginx**         | `utb_nginx_prod`         | `80`, `443` |     `80`      | `GET /healthz`       | Edge reverse proxy; routes `/` to web, `/api` to API, `/socket.io` to Realtime |
| **Web SPA**       | `utb_web_prod`           |      -      |     `80`      | Process check        | Vite + Tailwind React SPA compiled into Nginx Alpine runtime with SPA fallback |
| **API**           | `utb_api_prod`           |   `3000`    |    `3000`     | `GET /api/v1/health` | Core NestJS modular monolith REST API                                          |
| **Realtime**      | `utb_realtime_prod`      |   `3001`    |    `3001`     | `GET /api/v1/health` | Socket.io WebSocket gateway with Redis adapter                                 |
| **Worker**        | `utb_worker_prod`        |   `3002`    |    `3002`     | `GET /api/v1/health` | Standalone BullMQ background job processor                                     |
| **PgBouncer**     | `utb_pgbouncer_prod`     |   `6432`    |    `6432`     | `pg_isready -p 6432` | Connection pooler (Transaction mode); backend apps connect here                |
| **PostgreSQL**    | `utb_postgres_prod`      |   `5432`    |    `5432`     | `pg_isready -p 5432` | PostgreSQL 16 relational database (DBA direct port)                            |
| **MongoDB**       | `utb_mongo_prod`         |   `27017`   |    `27017`    | `mongosh ping`       | MongoDB 7 document store for parametric venue layouts                          |
| **Redis Stack**   | `utb_redis_prod`         |   `6379`    |    `6379`     | `redis-cli ping`     | Redis Stack server with RedisBloom (`bf:tickets`) and seat lock Lua scripts    |
| **Elasticsearch** | `utb_elasticsearch_prod` |   `9200`    |    `9200`     | `_cluster/health`    | Single-node search cluster for read models                                     |

---

## Production Orchestration

Run the complete production stack locally or on a remote VM:

```bash
# Build images and start all containers with health checks
docker compose -f docker-compose.prod.yml up -d --build

# Inspect running container status
docker compose -f docker-compose.prod.yml ps

# Follow container logs
docker compose -f docker-compose.prod.yml logs -f <service>

# Teardown stack
docker compose -f docker-compose.prod.yml down
```
