REGISTRY       = ghcr.io/luispabon
BACKEND_IMAGE  = $(REGISTRY)/openfitlab-backend
FRONTEND_IMAGE = $(REGISTRY)/openfitlab-frontend
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

.PHONY: docker-build
docker-build: docker-build-backend docker-build-frontend

.PHONY: docker-push-backend
docker-push-backend: docker-build-backend
	docker push $(BACKEND_IMAGE):$(TAG)

.PHONY: docker-push-frontend
docker-push-frontend: docker-build-frontend
	docker push $(FRONTEND_IMAGE):$(TAG)

.PHONY: docker-push
docker-push: docker-push-backend docker-push-frontend
