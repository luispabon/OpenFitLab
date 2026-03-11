#!/usr/bin/env bash
set -euo pipefail

SNAPSHOT="${1:-latest}"
SAFETY_FILE="/restores/pre-restore-$(date +%Y%m%dT%H%M%S).sql"

mkdir -p /restores

echo "[$(date -Iseconds)] Safety dump → $SAFETY_FILE"
mysqldump \
  -h "$DB_HOST" \
  -u "$DB_USER" \
  -p"$DB_PASSWORD" \
  --single-transaction \
  "$DB_DATABASE" \
  > "$SAFETY_FILE"
echo "[$(date -Iseconds)] Safety dump complete."

echo "[$(date -Iseconds)] Restoring snapshot: $SNAPSHOT"
restic dump "$SNAPSHOT" /db.sql \
  | mysql \
      -h "$DB_HOST" \
      -u "$DB_USER" \
      -p"$DB_PASSWORD" \
      "$DB_DATABASE"

echo "[$(date -Iseconds)] Restore complete."
