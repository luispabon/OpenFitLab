# OpenFitLab API (Backend)

Node.js Express API for OpenFitLab. See [AGENTS.md](../AGENTS.md) at project root for quickstart and full stack layout.

## Structure

- **Entry**: `src/index.js` — Express app, CORS, JSON body, mounts routes, central error handler.
- **Routes**: `src/routes/events.js`, `comparisons.js`, `meta.js` — validation + service calls only; no direct DB access.
- **Services**: `src/services/*` — business logic and all SQL. Each service that uses the DB accepts optional `opts.db` for test injection.
- **DB layer**: `src/db.js` — `query`, `queryOne`, `transaction`; schema in `sql/schema.sql` (run on startup, no migrations).
- **Parsers**: `src/parsers/file-parser.js` — file parsing (TCX, FIT, GPX, JSON, SML) via sports-lib.
- **Utils**: `src/utils/` — validation (Express middleware), transforms (row → API shape), stream-extractor, json-sanitizer.
- **Middleware**: `src/middleware/async-handler.js` — shared wrapper for async route handlers.

## Data access

- All SQL lives in **services** (no repository layer). Use `db.query()`, `db.queryOne()`, and `db.transaction(fn)`; inside a transaction use `conn.execute()`.
- **event-delete-service** uses `db.query()` for DELETE and checks `result.affectedRows` (same pattern as other services).
- For unit tests, inject a fake `db` with `query`, `queryOne`, and where needed `transaction` (and `getPool` only if the code path uses it).

## Errors

- **ParseError** (`src/errors.js`): thrown for file parse failures. Central handler maps `err.statusCode` (400) to HTTP 400; otherwise 500.

## Run locally

```bash
cd backend
npm install
# Set DB_* env if not using defaults (see AGENTS.md)
npm run dev
```

API: http://localhost:3000. Health: GET `/health`.

## Indexes (schema)

See `sql/schema.sql`. Key indexes: `events.start_date`; `activities` (event_id, type, device_name, start_date); `stream_data_points` (stream_id, time_ms) and (stream_id, sequence_index, time_ms) for stream fetch order; `comparisons.created_at`.
