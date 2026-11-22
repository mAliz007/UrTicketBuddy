#!/usr/bin/env bash
# ==============================================================================
# UrTicketBuddy Automated Backup Pruning & Retention Script
# Enforces automated backup retention policy (default: 7 days).
# Removes outdated backup archives, checksums, and manifests.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

echo "===================================================================="
echo "[PRUNE START] UrTicketBuddy Backup Retention Cleaner"
echo "Backup Directory: ${BACKUP_DIR}"
echo "Retention Policy: ${RETENTION_DAYS} days"
echo "===================================================================="

if [ ! -d "${BACKUP_DIR}" ]; then
  echo "Backup directory '${BACKUP_DIR}' does not exist. Nothing to prune."
  exit 0
fi

TARGET_DIRS=("${BACKUP_DIR}/postgres" "${BACKUP_DIR}/mongo" "${BACKUP_DIR}/redis" "${BACKUP_DIR}/manifests")

DELETED_COUNT=0

for dir in "${TARGET_DIRS[@]}"; do
  if [ -d "${dir}" ]; then
    echo "Scanning directory: ${dir}..."
    # Find and delete files older than RETENTION_DAYS
    while IFS= read -r file; do
      if [ -n "${file}" ]; then
        echo " -> Pruning expired backup: $(basename "${file}")"
        rm -f "${file}"
        DELETED_COUNT=$((DELETED_COUNT + 1))
      fi
    done < <(find "${dir}" -type f -mtime +"${RETENTION_DAYS}" 2>/dev/null || true)
  fi
done

echo "===================================================================="
echo "[PRUNE COMPLETE] Pruned ${DELETED_COUNT} expired backup file(s)."
echo "===================================================================="
