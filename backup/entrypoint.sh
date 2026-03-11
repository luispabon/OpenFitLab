#!/usr/bin/env bash
set -euo pipefail

restic snapshots &>/dev/null || restic init

echo "0 * * * * /backup.sh >> /var/log/backup.log 2>&1" | crontab -

/backup.sh

exec crond -f -d 8
