#!/usr/bin/env bash
set -euo pipefail

echo "[$(date -Iseconds)] Starting backup..."

mysqldump \
  -h "$DB_HOST" \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  --single-transaction \
  "$DB_DATABASE" \
  | restic backup \
      --stdin \
      --stdin-filename db.sql \
      --tag hourly

echo "[$(date -Iseconds)] Pruning..."

restic forget \
  --keep-hourly  24 \
  --keep-daily    7 \
  --keep-weekly   4 \
  --keep-monthly  6 \
  --prune

echo "[$(date -Iseconds)] Done."
