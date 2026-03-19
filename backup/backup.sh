#!/usr/bin/env bash
set -euo pipefail

BACKUP_TAG="manual"
for arg in "$@"; do
  case "$arg" in
    --tag=*) BACKUP_TAG="${arg#--tag=}" ;;
  esac
done

echo "[$(date -Iseconds)] Starting backup (tag: $BACKUP_TAG)..."

mysqldump \
  -h "$DB_HOST" \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  --single-transaction \
  "$DB_DATABASE" \
  | restic backup \
      --stdin \
      --stdin-filename db.sql \
      --tag "$BACKUP_TAG" \
      --host openfitlab-db

echo "[$(date -Iseconds)] Pruning..."

restic forget  \
  --keep-hourly  24 \
  --keep-daily    7 \
  --keep-weekly   4 \
  --keep-monthly  6 \
  --prune \
  --host openfitlab-db

echo "[$(date -Iseconds)] Done."
