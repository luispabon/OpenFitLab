REGISTRY       = ghcr.io/luispabon
BACKEND_IMAGE  = $(REGISTRY)/openfitlab-backend
FRONTEND_IMAGE = $(REGISTRY)/openfitlab-frontend
BACKUP_IMAGE   = $(REGISTRY)/openfitlab-backup
DOCKER_TAG ?= $(shell git rev-parse --abbrev-ref HEAD)

# Re-initialise the database from scratch: remove DB volume, then start the stack.
# The API runs db.initializeSchema() on startup, so the schema is applied to the fresh DB.
.PHONY: db-reset
db-reset:
	docker-compose down -v db valkey
	docker-compose up -d
	docker-compose restart api

# Print an ASCII summary of users, events, and activities (requires stack up).
.PHONY: stats-summary
stats-summary:
	@echo "Metric                  | Value"
	@echo "------------------------+-------"
	@docker-compose exec -T db sh -c 'mariadb -u "$$MARIADB_USER" -p"$$MARIADB_PASSWORD" "$$MARIADB_DATABASE" -N -e "SELECT (SELECT COUNT(*) FROM users), (SELECT COUNT(*) FROM events), (SELECT COUNT(*) FROM activities), COALESCE(ROUND((SELECT COUNT(*) FROM events)/NULLIF((SELECT COUNT(*) FROM users),0),2),0), COALESCE(ROUND((SELECT COUNT(*) FROM activities)/NULLIF((SELECT COUNT(*) FROM users),0),2),0)"' | \
	awk 'BEGIN {FS="\t"} {printf "%-24s | %6s\n", "Users", $$1; printf "%-24s | %6s\n", "Total events", $$2; printf "%-24s | %6s\n", "Total activities", $$3; printf "%-24s | %6s\n", "Avg events per user", $$4; printf "%-24s | %6s\n", "Avg activities per user", $$5}'

.PHONY: docker-build-backend
docker-build-backend:
	docker build --target prod -t $(BACKEND_IMAGE):$(DOCKER_TAG) backend/

.PHONY: docker-build-frontend
docker-build-frontend:
	docker build --target prod \
	  $(if $(VITE_GA_MEASUREMENT_ID),--build-arg VITE_GA_MEASUREMENT_ID=$(VITE_GA_MEASUREMENT_ID)) \
	  -t $(FRONTEND_IMAGE):$(DOCKER_TAG) frontend/

.PHONY: docker-build-backup
docker-build-backup:
	docker build -t $(BACKUP_IMAGE):$(DOCKER_TAG) backup/

.PHONY: docker-build
docker-build: docker-build-backend docker-build-frontend docker-build-backup

.PHONY: docker-push-backend
docker-push-backend: docker-build-backend
	docker push $(BACKEND_IMAGE):$(DOCKER_TAG)

.PHONY: docker-push-frontend
docker-push-frontend: docker-build-frontend
	docker push $(FRONTEND_IMAGE):$(DOCKER_TAG)

.PHONY: docker-push-backup
docker-push-backup: docker-build-backup
	docker push $(BACKUP_IMAGE):$(DOCKER_TAG)

.PHONY: docker-push
docker-push: docker-push-backend docker-push-frontend docker-push-backup

# ── Backup / Restore ─────────────────────────────────────────────────────────

.PHONY: backup-list
backup-list:
	docker-compose --profile backup exec backup restic snapshots

.PHONY: backup-now
backup-now:
	docker-compose --profile backup exec backup /backup.sh

# Restore latest snapshot. Safety-dumps current DB first.
.PHONY: backup-restore
backup-restore:
	docker-compose --profile backup exec backup /restore.sh latest

# Restore a specific snapshot: make backup-restore-snapshot SNAPSHOT=abc12345
.PHONY: backup-restore-snapshot
backup-restore-snapshot:
ifndef SNAPSHOT
	$(error SNAPSHOT is required. Usage: make backup-restore-snapshot SNAPSHOT=<id>)
endif
	docker-compose --profile backup exec backup /restore.sh $(SNAPSHOT)

# Copy the most recent safety dump out of the Docker volume to the current directory
.PHONY: backup-fetch-safety-dump
backup-fetch-safety-dump:
	docker-compose --profile backup exec backup sh -c \
	  'ls -t /restores/*.sql | head -1 | xargs cat' > safety-dump-$(shell date +%Y%m%dT%H%M%S).sql

# ── DAST (ZAP API scan) ───────────────────────────────────────────────────────
#
# Spins up the stack with relaxed rate limits, seeds a disposable test user +
# session into MariaDB/Valkey (no codebase auth backdoor), then runs ZAP against
# the OpenAPI spec with the session cookie and CSRF token injected.
#
# Usage:
#   make dast          — full pipeline: up → seed → scan (stack stays up)
#   make dast-down     — tear down stack and remove volumes when done
#
# Reports are written to ./zap-reports/ (gitignored).
# Set ZAP_REPORT_DIR to override: make dast ZAP_REPORT_DIR=/tmp/reports

ZAP_REPORT_DIR  ?= $(CURDIR)/zap-reports
DAST_COOKIE_FILE = /tmp/ofl-dast-cookie
DAST_PROJECT     = openfitlab-dast
DAST_API_PORT   ?= 3099
DAST_DB_PORT    ?= 3307

# Shorthand so every docker-compose call in a DAST target uses the same flags.
DAST_COMPOSE = DB_HOST_PORT=$(DAST_DB_PORT) API_HOST_PORT=$(DAST_API_PORT) \
               docker-compose -p $(DAST_PROJECT) -f compose.yaml -f compose.dast.yaml

.PHONY: dast-up
dast-up:
	$(DAST_COMPOSE) up -d db valkey api
	@echo "Waiting for API to be healthy..."
	@timeout 180 bash -c 'until curl -sf http://localhost:$(DAST_API_PORT)/health > /dev/null; do sleep 3; done'
	@echo "API is ready."

# Runs inside the api container so it can reach db/valkey via internal Docker DNS
# and use the backend's installed node_modules.
.PHONY: dast-seed
dast-seed:
	@OUTPUT=$$($(DAST_COMPOSE) exec -T api node scripts/dast-seed.mjs) && \
	  COOKIE=$$(printf '%s\n' "$$OUTPUT" | grep '^SESSION_COOKIE=' | cut -d'=' -f2-) && \
	  [ -n "$$COOKIE" ] || { echo "dast-seed: no SESSION_COOKIE in output" >&2; exit 1; } && \
	  printf '%s' "$$COOKIE" > $(DAST_COOKIE_FILE) && \
	  echo "Session cookie saved to $(DAST_COOKIE_FILE)"

# Fetches the CSRF token from /api/auth/me, writes a ZAP replacer properties file,
# then runs ZAP in Docker with --network host so it can reach localhost:$(DAST_API_PORT).
# -O overrides the server URL baked into openapi.yaml (localhost:3000) with the DAST port.
.PHONY: dast-scan
dast-scan:
	@COOKIE=$$(cat $(DAST_COOKIE_FILE)) && \
	RESPONSE=$$(curl -sf -H "Cookie: ofl.sid=$$COOKIE" http://localhost:$(DAST_API_PORT)/api/auth/me) && \
	TOKEN=$$(printf '%s' "$$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['csrfToken'])") && \
	CONFIG=$$(mktemp /tmp/zap-config-XXXXXX.properties) && \
	printf '%s\n' \
	  "replacer.full_list(0).description=session_cookie" \
	  "replacer.full_list(0).enabled=true" \
	  "replacer.full_list(0).matchtype=REQ_HEADER" \
	  "replacer.full_list(0).matchstr=Cookie" \
	  "replacer.full_list(0).replacement=ofl.sid=$$COOKIE" \
	  "replacer.full_list(1).description=csrf_token" \
	  "replacer.full_list(1).enabled=true" \
	  "replacer.full_list(1).matchtype=REQ_HEADER" \
	  "replacer.full_list(1).matchstr=x-csrf-token" \
	  "replacer.full_list(1).replacement=$$TOKEN" \
	  > "$$CONFIG" && \
	mkdir -p $(ZAP_REPORT_DIR) && \
	docker run --rm \
	  --network host \
	  -v $(CURDIR):/zap/wrk:ro \
	  -v $(ZAP_REPORT_DIR):/zap/reports \
	  -v "$$CONFIG":/tmp/zap.properties:ro \
	  ghcr.io/zaproxy/zaproxy:stable \
	  zap-api-scan.py \
	    -t /zap/wrk/backend/docs/openapi.yaml \
	    -f openapi \
	    -O http://localhost:$(DAST_API_PORT) \
	    -I \
	    -r /zap/reports/report.html \
	    -J /zap/reports/report.json \
	    -z "-configfile /tmp/zap.properties" ; \
	EXIT=$$? ; rm -f "$$CONFIG" ; \
	echo "Reports written to $(ZAP_REPORT_DIR)" ; exit $$EXIT

.PHONY: dast-down
dast-down:
	$(DAST_COMPOSE) down -v

.PHONY: dast
dast: dast-up dast-seed dast-scan

# ── E2E (Playwright) ─────────────────────────────────────────────────────────
#
# Spins up the full stack (db, valkey, api, frontend) with relaxed rate limits,
# seeds a disposable test user + session, then runs the Playwright suite.
#
# Usage:
#   make e2e          — full pipeline: install → up → run (stack stays up on pass)
#   make e2e-install  — install/update Playwright and Chromium browser
#   make e2e-down     — tear down stack and remove volumes when done
#
# Reports are written to ./e2e/playwright-report/ and ./e2e/test-results/ (gitignored).

E2E_API_PORT   ?= 3098
E2E_DB_PORT    ?= 3308
E2E_FRONT_PORT ?= 4201
E2E_PROJECT     = openfitlab-e2e
E2E_COOKIE_FILE = /tmp/ofl-e2e-cookie

# Shorthand so every docker compose call in an E2E target uses the same flags.
E2E_COMPOSE = DB_HOST_PORT=$(E2E_DB_PORT) API_HOST_PORT=$(E2E_API_PORT) FRONT_HOST_PORT=$(E2E_FRONT_PORT) \
              docker compose -p $(E2E_PROJECT) -f compose.yaml -f compose.e2e.yaml

.PHONY: e2e-up
e2e-up:
	$(E2E_COMPOSE) up -d db valkey api frontend
	@echo "Waiting for API to be healthy..."
	@timeout 180 bash -c 'until curl -sf http://localhost:$(E2E_API_PORT)/health > /dev/null; do sleep 3; done'
	@echo "API is ready."
	@echo "Waiting for frontend to be healthy..."
	@timeout 120 bash -c 'until curl -sf http://localhost:$(E2E_FRONT_PORT) > /dev/null; do sleep 3; done'
	@echo "Frontend is ready."

.PHONY: e2e-seed
e2e-seed:
	@OUTPUT=$$($(E2E_COMPOSE) exec -T api node scripts/e2e-seed.mjs) && \
	  COOKIE=$$(printf '%s\n' "$$OUTPUT" | grep '^SESSION_COOKIE=' | cut -d'=' -f2-) && \
	  [ -n "$$COOKIE" ] || { echo "e2e-seed: no SESSION_COOKIE in output" >&2; exit 1; } && \
	  printf '%s' "$$COOKIE" > $(E2E_COOKIE_FILE) && \
	  echo "Session cookie saved to $(E2E_COOKIE_FILE)"

.PHONY: e2e-run
e2e-run:
	cd e2e && E2E_API_PORT=$(E2E_API_PORT) E2E_FRONT_PORT=$(E2E_FRONT_PORT) \
	  E2E_BASE_URL=http://localhost:$(E2E_FRONT_PORT) \
	  E2E_COMPOSE_PROJECT=$(E2E_PROJECT) \
	  npx playwright test

.PHONY: e2e-install
e2e-install:
	cd e2e && npm ci && npx playwright install --with-deps chromium

.PHONY: e2e-down
e2e-down:
	$(E2E_COMPOSE) down -v

.PHONY: e2e
e2e: e2e-install e2e-up e2e-run
