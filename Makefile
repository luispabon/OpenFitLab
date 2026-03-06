# Re-initialise the database from scratch: remove DB volume, then start the stack.
# The API runs db.initializeSchema() on startup, so the schema is applied to the fresh DB.
.PHONY: db-reset
db-reset:
	docker compose down -v db valkey
	docker compose up -d
	docker-compose restart api
