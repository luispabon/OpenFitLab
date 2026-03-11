REGISTRY       = ghcr.io/luispabon
BACKEND_IMAGE  = $(REGISTRY)/openfitlab-backend
FRONTEND_IMAGE = $(REGISTRY)/openfitlab-frontend
BACKUP_IMAGE   = $(REGISTRY)/openfitlab-backup
TAG ?= latest

# Re-initialise the database from scratch: remove DB volume, then start the stack.
# The API runs db.initializeSchema() on startup, so the schema is applied to the fresh DB.
.PHONY: db-reset
db-reset:
	docker compose down -v db valkey
	docker compose up -d
	docker compose restart api

.PHONY: docker-build-backend
docker-build-backend:
	docker build --target prod -t $(BACKEND_IMAGE):$(TAG) backend/

.PHONY: docker-build-frontend
docker-build-frontend:
	docker build --target prod -t $(FRONTEND_IMAGE):$(TAG) frontend/

.PHONY: docker-build-backup
docker-build-backup:
	docker build -t $(BACKUP_IMAGE):$(TAG) backup/

.PHONY: docker-build
docker-build: docker-build-backend docker-build-frontend docker-build-backup

.PHONY: docker-push-backend
docker-push-backend: docker-build-backend
	docker push $(BACKEND_IMAGE):$(TAG)

.PHONY: docker-push-frontend
docker-push-frontend: docker-build-frontend
	docker push $(FRONTEND_IMAGE):$(TAG)

.PHONY: docker-push-backup
docker-push-backup: docker-build-backup
	docker push $(BACKUP_IMAGE):$(TAG)

.PHONY: docker-push
docker-push: docker-push-backend docker-push-frontend docker-push-backup

# ── Backup / Restore ─────────────────────────────────────────────────────────

.PHONY: backup-list
backup-list:
	docker compose --profile backup exec backup restic snapshots

.PHONY: backup-now
backup-now:
	docker compose --profile backup exec backup /backup.sh

# Restore latest snapshot. Safety-dumps current DB first.
.PHONY: backup-restore
backup-restore:
	docker compose --profile backup exec backup /restore.sh latest

# Restore a specific snapshot: make backup-restore-snapshot SNAPSHOT=abc12345
.PHONY: backup-restore-snapshot
backup-restore-snapshot:
ifndef SNAPSHOT
	$(error SNAPSHOT is required. Usage: make backup-restore-snapshot SNAPSHOT=<id>)
endif
	docker compose --profile backup exec backup /restore.sh $(SNAPSHOT)

# Copy the most recent safety dump out of the Docker volume to the current directory
.PHONY: backup-fetch-safety-dump
backup-fetch-safety-dump:
	docker compose --profile backup run --rm backup sh -c \
	  'ls -t /restores/*.sql | head -1 | xargs cat' > safety-dump-$(shell date +%Y%m%dT%H%M%S).sql
