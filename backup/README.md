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

## MariaDB image upgrades (existing data volumes)

Compose pins the MariaDB image (`compose.yaml`, `compose.prod.yaml`). Starting a newer major version on an existing `db_data` volume upgrades the data directory in place, after which the previous version may refuse to read it.

Before changing that pin:

1. **Take a verified backup.** Run `make backup-now` and confirm the snapshot appears in `make backup-list`. Do not upgrade without a backup you have checked restores.
2. **Use the existing backup/restore procedures.** Dump the database from the running version (`mysqldump`, as `restore.sh` does for its safety dump), start the new image on a fresh volume, and load that dump into it (`make backup-restore`, or `mysqldump` + `mysql` directly).
3. **`make db-reset` is for disposable dev data only.** It removes the `db_data` volume (`docker compose down -v`). Never run it against data you need.
4. **Do not downgrade a volume that has already started MariaDB 13 in place.** The 13.x data directory is not readable by 12.x. Dump from the 13.x container and restore into a fresh volume on the older image, or recreate the volume and restore from backup.
