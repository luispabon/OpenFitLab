# OpenFitLab API (Backend)

Node.js Express API for OpenFitLab. See [AGENTS.md](../AGENTS.md) at project root for quickstart and full stack layout.

## Structure

- **Entry**: `src/index.js` — Express app, CORS, JSON body, mounts routes, central error handler.
- **Routes**: `src/routes/events.js`, `comparisons.js`, `folders.js`, `account.js`, `auth.js`, `integrations-strava.js`, `meta.js` — validation + service calls only; no direct DB access.
- **Services**: `src/services/*` — business logic; they call **repositories** and orchestrate transactions. Each service accepts optional `opts.db` for test injection. Examples: `event-query-service` / `event-upload-service` / `event-persistence` (shared persist), `event-delete-service`, `event-update-service`, `comparison-service`, `folder-service`, `account-service`, `auth-service`, `strava-oauth-service`, `strava-integration-service`.
- **Repositories**: `src/repositories/*` — all SQL lives here. `event-repository`, `activity-repository`, `stream-repository`, `comparison-repository`, `folder-repository`, `user-repository`; each uses `query-helper.runQuery` / `runQueryOne` so that `opts.conn` (inside a transaction) or `opts.db` is used.
- **DB layer**: `src/db.js` — `query`, `queryOne`, `transaction`, `runMigrations`; migrations in `sql/migrations/` (applied in order on startup via advisory lock).
- **Parsers**: `src/parsers/file-parser.js` — file parsing (TCX, FIT, GPX, JSON, SML) via sports-lib.
- **Utils**: `src/utils/` — validation (Express middleware), transforms (row → API shape), stream-extractor, json-sanitizer.
- **Middleware**: `src/middleware/async-handler.js` — shared wrapper for async route handlers.

## Data access

SQL in repositories only; services pass `opts.db` or `opts.conn` (inside transactions). See [.cursor/rules/backend-architecture.mdc](../.cursor/rules/backend-architecture.mdc) for full conventions (transactions, routes, testing).

## Errors

Defined in `src/errors.js`. The central error handler maps these to HTTP responses (`{ "error": "<message>" }`):

- **ParseError** (400): file parse failures.
- **ValidationError** (400): invalid input.
- **NotFoundError** (404): missing or not-owned resources (by ID).
- **StravaTokenExpiredError** (401): Strava session token unusable; client should reconnect.
- **StravaRateLimitError** (429): Strava upstream rate limit; may set `Retry-After`.
- **StravaUpstreamError** (502): Strava API/network failure.

Generic `Error` with `statusCode` is also respected when set.

## Run locally

Install deps, configure `.env` (see root `.env.example` and [AGENTS.md](../AGENTS.md)), then `npm run dev` in this directory. API: `http://localhost:3000`; health: `GET /health`.

## Strava import (optional)

When `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are set in the environment (see root `.env.example`), Strava OAuth and import routes are enabled. In the [Strava API application settings](https://www.strava.com/settings/api), set the **Authorization Callback Domain** to your API host and add this **exact** redirect URI:

`{OAUTH_CALLBACK_URL}/api/integrations/strava/callback`

(for example `http://localhost:3000/api/integrations/strava/callback` when the API listens on port 3000).

## Test coverage

- **`npm run test:coverage`** — Run unit tests with coverage (terminal summary). Uses Node’s `--experimental-test-coverage`.
- **`npm run test:coverage:lcov`** — Same plus write LCOV to `coverage/lcov.info` (for CI/IDEs). Creates `coverage/` if needed; the directory is in `.gitignore`.

To exclude code from coverage, use Node’s inline comments: `/* node:coverage ignore */` for a block, or `/* node:coverage ignore next */` / `/* node:coverage ignore next N */` for one or more lines.

## Indexes (schema)

See `sql/schema.sql`. Key indexes:

- **`users`**: primary key on `id`.
- **`user_identities`**: unique (provider, provider_user_id); index on `user_id`.
- **`events`**: `start_date`; `user_id`; composite (user_id, start_date).
- **`activities`**: indexes on `event_id`, `type`, `device_name`, `start_date`.
- **`streams`**: (activity_id), (type); stream data stored as compressed JSON in `data` column.
- **`comparisons`**: `created_at`; `user_id`; composite (user_id, created_at).
