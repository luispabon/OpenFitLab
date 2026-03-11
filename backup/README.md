# Database Backups

Hourly `mysqldump` piped into [Restic](https://restic.net/), stored encrypted on Google Cloud Storage.

## One-time GCS setup

1. **Create a GCS bucket** (e.g. `openfitlab-backups`). Enable uniform bucket-level access. Versioning is not needed — Restic manages its own snapshots.

2. **Create a service account** in GCP IAM with the **Storage Object Admin** role scoped to that bucket.

3. **Download the JSON key** → save as `backup/secrets/gcs-key.json` (this path is gitignored).

4. **Set env vars in `.env`:**
   ```bash
   RESTIC_REPOSITORY=gs:openfitlab-backups:/prod
   RESTIC_PASSWORD=<strong-passphrase>   # openssl rand -hex 32
   GOOGLE_PROJECT_ID=<your-gcp-project-id>
   ```

5. **Start the backup service:**
   ```bash
   docker compose --profile backup up -d backup
   ```
   The entrypoint initialises the Restic repo and runs the first backup immediately.

## Day-to-day operations

| Command | What it does |
|---|---|
| `make backup-list` | List all snapshots |
| `make backup-now` | Run a backup immediately |
| `make backup-restore` | Restore latest snapshot (safety-dumps current DB first) |
| `make backup-restore-snapshot SNAPSHOT=<id>` | Restore a specific snapshot |
| `make backup-fetch-safety-dump` | Copy the most recent safety dump to the current directory |

## Retention policy

| Period | Kept |
|---|---|
| Hourly | Last 24 |
| Daily | Last 7 |
| Weekly | Last 4 |
| Monthly | Last 6 |

## Restore flow

`restore.sh` always writes a safety dump to `/restores/pre-restore-<timestamp>.sql` (in the `restores` Docker volume) before applying any snapshot. If the restore goes wrong you can pipe that file back into `mysql` manually.
