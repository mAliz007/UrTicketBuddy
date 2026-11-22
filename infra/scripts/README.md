# Infrastructure Automation Scripts (`infra/scripts/`)

This directory houses infrastructure automation scripts for host provisioning, automated multi-database backups, disaster recovery restore drills, and retention pruning.

## Scripts Overview

### 1. `backup-all.sh`

Performs automated multi-database hot backups for all 3 UrTicketBuddy datastores:

- **PostgreSQL**: TypeORM transactional relational source of truth (`pg_dump -Fc` custom compressed dump).
- **MongoDB**: Venue layout document store (`mongodump --archive --gzip`).
- **Redis**: Transient locks and RedisBloom filter (`redis-cli bgsave` and RDB extraction).

Generates a unified manifest file: `backups/manifests/manifest_<timestamp>.json` detailing file paths, sizes, and cryptographically verified **SHA256 checksums**.

```bash
# Execute backup with default local settings
bash infra/scripts/backup-all.sh

# Execute with custom environment settings
BACKUP_DIR="/custom/backups" POSTGRES_PORT=5432 bash infra/scripts/backup-all.sh
```

### 2. `restore-drill.sh`

Executes non-destructive automated Disaster Recovery (DR) restore drills:

1. Validates all backup archives against SHA256 checksums from the latest manifest.
2. Creates an isolated temporary drill database (e.g. `urticketbuddy_drill_<timestamp>`).
3. Restores database dumps and runs verification queries checking schema and data availability.
4. Drops temporary drill databases cleanly.
5. Verifies Redis RDB magic byte headers (`REDIS`).
6. Computes **Recovery Time Objective (RTO)** in seconds and generates a structured drill report in `backups/reports/drill-report-<timestamp>.json`.

```bash
# Run drill on latest backup
bash infra/scripts/restore-drill.sh

# Run drill on specific manifest
bash infra/scripts/restore-drill.sh backups/manifests/manifest_20261122_120000Z.json
```

### 3. `prune-backups.sh`

Enforces automated backup retention policies (default: 7 days):

- Scans `backups/postgres`, `backups/mongo`, `backups/redis`, and `backups/manifests`.
- Deletes archives and manifests exceeding the retention threshold.

```bash
# Prune backups older than 7 days
bash infra/scripts/prune-backups.sh

# Prune with custom retention policy (e.g. 14 days)
RETENTION_DAYS=14 bash infra/scripts/prune-backups.sh
```

### 4. `setup-oracle-vm.sh`

Host bootstrap automation for Oracle Cloud Infrastructure (OCI) Always Free VM (ADR-0002).
Configures NVMe swap space, Docker Engine 28, UFW firewall, and deployment directory.
