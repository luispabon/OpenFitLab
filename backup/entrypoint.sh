#!/usr/bin/env bash
set -euo pipefail

restic snapshots &>/dev/null || restic init

exec supercronic /crontab
