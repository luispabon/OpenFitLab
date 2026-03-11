# AGENTS

## Purpose and scope

**Role:** Fast AI-agent entrypoint. Use this file for operational context, safety rules, and where to look next. Deep technical reference lives in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Product intent lives in [docs/PRD.md](docs/PRD.md).

## Quickstart

1. Copy `.env.example` to `.env` and fill in required values (see [Configuration, runtime, and deployment](docs/ARCHITECTURE.md#configuration-runtime-and-deployment) in ARCHITECTURE.md).
2. Start the local stack from the repo root with `docker compose up -d`.
3. Services:
   - API: `http://localhost:3000`
   - Frontend: `http://localhost:4200`
   - MariaDB: `localhost:3306`
   - Adminer: `http://localhost:8080`
4. Reset the database: `make db-reset`
5. Stop with `docker compose down` or `docker compose down -v` to remove volumes.

## Key commands

### Backend

- Run: `npm run dev` in `backend/`
- Checks: `npm run format`, `npm run lint`, `npm run test`
- Coverage: `npm run test:coverage`
- Runtime: Node 24+

### Frontend

- Run: `npm run dev` in `frontend/`
- Main quality gate: `npm run ci`
- Runtime: Node 20+

### DAST

- Run full local scan (stack up + seed + ZAP): `make dast`
- Tear down DAST stack and volumes: `make dast-down`
- Reports are written to `./zap-reports/` (gitignored). Override with `ZAP_REPORT_DIR=/path make dast`.

### Docker images

- Build both images: `make docker-build`
- Build backend only: `make docker-build-backend`
- Build frontend only: `make docker-build-frontend`
- Build and push both to GHCR: `make docker-push`
- Registry: `ghcr.io/luispabon` (images: `openfitlab-backend`, `openfitlab-frontend`)

### CI

- Backend: lint, format, unit tests (including Node 24 deprecation check), coverage. See `.github/workflows/backend-checks.yml`.
- Frontend: format, lint, svelte-check, tests with coverage, build. See `.github/workflows/frontend-checks.yml`.
- Security: Gitleaks, dependency-review, Semgrep, Trivy on PRs. See `.github/workflows/security-checks.yml`.
- DAST: ZAP API scan against the OpenAPI spec, weekly (Tuesdays) and on demand. See `.github/workflows/dast.yml`.

## Agent-critical invariants

- Authentication is server-side session auth with OAuth providers and a Valkey-backed session store. Do not introduce JWT or localStorage auth.
- State-changing requests require the CSRF token returned by `GET /api/auth/me`.
- All event, comparison, folder, and derived meta queries must be scoped by authenticated ownership using `req.userId`.
- Return `404` for missing or not-owned resources by ID to avoid leaking existence.
- Files are parsed on the backend (TCX, FIT, GPX, JSON, SML via `@sports-alliance/sports-lib`) and discarded. Do not store originals after upload.
- Stats stay relational in `event_stats` and `activity_stats`. Do not collapse them into JSON blobs.
- Stream points stay relational in `stream_data_points` with `time_ms` and `sequence_index`.
- Comparison membership stays relational in `comparison_event_activities`.
- Deleting an event must remove comparisons that reference it before the event delete completes.
- New foreign keys must use `ON DELETE CASCADE` unless there is a specific reason to unfile rather than delete (like `folder_id` which uses `SET NULL`).
- Schema is defined in `backend/sql/schema.sql` and applied on startup. There are no migrations; schema changes require DB recreation.
- Backend configuration must come from `backend/src/config.js`, not direct `process.env` reads elsewhere.

## API contract

The full machine-readable API specification is at [`backend/docs/openapi.yaml`](backend/docs/openapi.yaml) (OpenAPI 3.1).

Key points:
- All protected endpoints require a valid session cookie (`ofl.sid`).
- All state-changing requests (POST, PATCH, DELETE) must include the `CSRF-Token` header. Obtain it from `GET /api/auth/me`.
- Error responses are always `{ "error": "<message>" }`.
- Missing or unowned resources return `404`, not `403`.
- Response shapes for events and activities are produced by `mapEventRow` and `mapActivityRow` in `backend/src/utils/transforms.js`.

## Conventions

### Backend

- All SQL lives in repositories (`backend/src/repositories/`). Services and routes must not contain SQL.
- Routes are thin: validate input, call a service, return the response. No business logic in route handlers.
- Input validation is Express middleware in `backend/src/utils/validation.js`.
- Services accept `opts.db` for dependency injection and use `db.transaction()` for multi-statement writes.
- Errors use `ParseError`, `ValidationError`, or `NotFoundError` from `backend/src/errors.js`. The central error handler maps `statusCode` to HTTP status; do not send ad-hoc error responses.
- API error responses use `{ error: string }`.
- API response shapes are built by helpers in `backend/src/utils/transforms.js` (`mapEventRow`, `mapActivityRow`, `aggregateStats`).

### Frontend

- Svelte 5 runes only: `$state()`, `$derived()`, `$effect()`, `$props()`. Do not use legacy `let` reactivity, `$:`, or `export let`.
- Tailwind CSS v4 only. No component-level `<style>` blocks for layout or colors.
- `svelte-spa-router` for routing.
- Do not use `@sports-alliance/sports-lib` in the frontend.

## Key entry points

### Backend

- App bootstrap: `backend/src/index.js`
- Auth/session: `backend/src/routes/auth.js`, `backend/src/middleware/session.js`, `backend/src/middleware/require-auth.js`, `backend/src/middleware/passport.js`
- Events: `backend/src/routes/events.js`, `backend/src/services/event-query-service.js`, `backend/src/services/event-upload-service.js`, `backend/src/services/event-delete-service.js`
- Comparisons: `backend/src/routes/comparisons.js`, `backend/src/services/comparison-service.js`
- Folders: `backend/src/routes/folders.js`, `backend/src/services/folder-service.js`
- Account: `backend/src/routes/account.js`, `backend/src/services/account-service.js`
- Schema/config: `backend/sql/schema.sql`, `backend/src/config.js`

### Frontend

- App shell and route guard: `frontend/src/App.svelte`
- Auth state and API client: `frontend/src/lib/stores/auth.svelte.ts`, `frontend/src/lib/api/client.ts`
- Folder state: `frontend/src/lib/stores/folders.svelte.ts`
- Routes: `frontend/src/routes/`
- API modules: `frontend/src/lib/api/`
- Shared types: `frontend/src/lib/types/event.ts`

## Validation checklist

After meaningful refactors, verify:

1. Login page appears when unauthenticated.
2. Sign-in reaches the dashboard.
3. Uploading a supported file creates an event.
4. Event detail loads stats, charts, and streams.
5. Comparisons list and comparison view still load.
6. Folder-filtered views still behave correctly.
7. Deleting an event removes it cleanly.

## When unsure

| Topic | Read |
|---|---|
| Technical reference | `docs/ARCHITECTURE.md` |
| Product intent | `docs/PRD.md` |
| API contract | `backend/docs/openapi.yaml` |
| API routes | `backend/src/routes/` |
| Auth flow | `backend/src/routes/auth.js`, `backend/src/middleware/session.js`, `backend/src/middleware/require-auth.js` |
| Events and uploads | `backend/src/services/event-query-service.js`, `backend/src/services/event-upload-service.js` |
| Comparisons | `backend/src/services/comparison-service.js`, `backend/src/routes/comparisons.js` |
| Folders | `backend/src/services/folder-service.js`, `backend/src/routes/folders.js` |
| Schema | `backend/sql/schema.sql` |
| Backend conventions | `backend/README.md`, `.cursor/rules/backend-architecture.mdc` |
| Frontend conventions | `.cursor/rules/svelte-frontend.mdc` |
| Frontend data flow | `frontend/src/routes/`, `frontend/src/lib/api/`, `frontend/src/lib/stores/auth.svelte.ts` |
| Package scripts | `backend/package.json`, `frontend/package.json` |

Read source before making assumptions.
