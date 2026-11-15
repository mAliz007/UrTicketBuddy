# Infrastructure (infra/)

Infrastructure, container orchestration, reverse proxy configurations, and load testing assets.

## Directory Structure

- `docker/`: Dockerfile configurations and service setup (e.g. `pgbouncer/`)
- `nginx/`: Nginx reverse proxy configuration (`nginx.conf`)
- `k8s/`: Kubernetes manifests (validated on Kind)
- `loadtests/`: k6 load testing scenarios
- `scripts/`: Operational and deployment automation scripts

## Services & Ports

| Service           | Direct Port                | Internal / Proxy Port | Healthcheck          |
| :---------------- | :------------------------- | :-------------------- | :------------------- |
| **Nginx**         | 80                         | -                     | `GET /healthz`       |
| **Web SPA**       | 5173                       | `/`                   | Vite server          |
| **API**           | 3000                       | `/api`                | `GET /api/v1/health` |
| **Realtime**      | 3001                       | `/socket.io`          | `GET /api/v1/health` |
| **Worker**        | 3002                       | -                     | `GET /api/v1/health` |
| **Postgres**      | 5432                       | -                     | `pg_isready`         |
| **PgBouncer**     | 6432 (Transaction Mode)    | -                     | `pg_isready`         |
| **MongoDB**       | 27017                      | -                     | `mongosh ping`       |
| **Redis Stack**   | 6379 (RedisBloom included) | -                     | `redis-cli ping`     |
| **Elasticsearch** | 9200                       | -                     | `_cluster/health`    |
| **pgAdmin**       | 5050                       | -                     | `GET /misc/ping`     |
