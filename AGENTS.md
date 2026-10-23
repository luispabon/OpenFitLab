# AGENTS

## Purpose and scope

**Role:** Agent entrypoint for this repo. Use this file for operational context, safety rules, and where to look next. The canonical technical reference is [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The API contract is [backend/docs/openapi.yaml](backend/docs/openapi.yaml).

This is the only tracked agent instruction file. Put agent conventions here, not in tool-specific files.

## Quickstart

1. Copy `.env.example` to `.env` and fill in required values (see [Configuration, runtime, and deployment](docs/ARCHITECTURE.md#configuration-runtime-and-deployment) in ARCHITECTURE.md).
2. Start the local stack from the repo root with `docker compose up -d`.
3. Services (all ports bound to `127.0.0.1` only):
   - API: `http://localhost:3000`
   - Frontend: `http://localhost:4200`
   - MariaDB: `localhost:3306`
   - Adminer: `http://localhost:8080`
4. Reset the database: `make db-reset` (disposable dev data only). Before changing the pinned MariaDB image on an existing volume, see [MariaDB image upgrades](backup/README.md#mariadb-image-upgrades-existing-data-volumes).
5. Stop with `docker compose down` or `docker compose down -v` to remove volumes.

## Key commands

### Backend

- Run: `npm run dev` in `backend/`
- Checks: `npm run format`, `npm run lint`, `npm run test`
- Coverage: `npm run test:coverage`
- Runtime: Node ^26.12.1 (patched against CVE-2026-111497, see https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)

### DB / stats

- Print summary table (users, events, activities, averages): `make stats-summary` (requires stack up)

### Frontend

- Run: `npm run dev` in `frontend/`
- Main quality gate: `npm run ci` (format, lint, svelte-check, tests, build)
- Runtime: Node ^26.12.1 locally (Docker and CI use Node 26.12.1)

### DAST

- Run full local scan (stack up + seed + ZAP): `make dast`
- Tear down DAST stack and volumes: `make dast-down`
- Reports are written to `./zap-reports/` (gitignored). Override with `ZAP_REPORT_DIR=/path make dast`.

### E2E (Playwright)

- Run full E2E suite (stack up + seed + tests): `make e2e`
- Tear down E2E stack and volumes: `make e2e-down`
- Reports: `e2e/playwright-report/` and `e2e/test-results/` (gitignored).
- Stack ports: API `3098`, DB `3308`, Frontend `4201` (avoids conflicts with dev stack).
- Test files live in `e2e/tests/`. Infrastructure: `e2e/global-setup.ts`, `e2e/fixtures/auth.ts`, `backend/scripts/e2e-seed.mjs`.

### Docker images

- Build all three images (backend, frontend, backup): `make docker-build`
- Build one image: `make docker-build-backend`, `make docker-build-frontend`, `make docker-build-backup`
- Build and push all three to GHCR: `make docker-push`
- Registry: `ghcr.io/luispabon` (images: `openfitlab-backend`, `openfitlab-frontend`, `openfitlab-backup`)

### CI

- Backend: lint, format, unit tests (including Node 26.12.1 deprecation check), coverage. See `.github/workflows/backend-checks.yml`.
- Frontend: format, lint, svelte-check, tests with coverage, build. See `.github/workflows/frontend-checks.yml`.
- Security: Gitleaks, dependency-review, Semgrep, and a Docker config Trivy scan on PRs to `main`. See `.github/workflows/security-checks.yml`.
- DAST: ZAP API scan against `backend/docs/openapi.yaml`, daily at 04:00 UTC and on demand. The same workflow runs a full-history secrets scan. See `.github/workflows/security-scheduled.yml`.
- E2E: Playwright browser tests on every PR targeting `main`. See `.github/workflows/e2e-checks.yml`. Image publishing (`publish.yml`) pushes the backend, frontend, and backup images only after the backend, frontend, and E2E check jobs pass. The suite does not call live Strava; Strava flows are covered by unit/integration tests and manual checks.
- Releases: pushing a `v*` tag creates a GitHub Release with generated notes, after the image build succeeds. See the `release` job in `.github/workflows/publish.yml`.

## Quality gates

- **Backend:** from `backend/`, `npm run format` and `npm run test` must exit 0, and `npm run lint` must report no errors or warnings. Run them before and after changes. Also run `npm run test:unit` or `npm run test:coverage` when you change service, repository, or DB behavior.
- **Frontend:** from `frontend/`, `npm run ci` must exit 0 (format, lint, svelte-check, tests, build), and lint must report no errors or warnings. Run it before and after changes. `npm run test` alone is not enough, because type errors surface in `npm run check`.
- **Tests:** new or changed backend behavior needs unit tests in `backend/test/unit/`, including error branches and edge cases. New or changed frontend logic needs `*.test.ts` tests under `frontend/src/` (for example in a `__tests__/` directory next to the module). Run the full suite, not only the new test file.
- **Local checks must match CI.** If a check fails, the task is not done. Fix the failure and rerun the full gate. Do not commit broken work. If a check cannot be fixed, report the exact error and do not mark the task complete.

## Commit messages

- Do not add a `Made-with` line, AI tool signature, git trailer, or footer.
- List changes under a bold `**Changes:**` line, with `*` bullets:

```
**Changes:**
 * Drop created_at from stream_data_points (never read)
 * Drop event_start_date from activities (redundant with event.start_date)
```

## Agent-critical invariants

Rules below are the non-negotiables for agents changing code. **Schema shape, storage layout, migrations, deployment, and security details** are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Read that for full context instead of duplicating it here.

- Server-side sessions (OAuth + Valkey store). **No** JWT or localStorage auth.
- State-changing requests need the CSRF token from `GET /api/auth/me`. Send it as **`CSRF-Token`** (SPA default) or **`x-csrf-token`** (also accepted; see [`backend/docs/openapi.yaml`](backend/docs/openapi.yaml)).
- Scope all event, comparison, folder, and meta queries by authenticated ownership (`req.userId`).
- **`404`** for missing or not-owned resources by ID (no existence leaks).
- Parse files only on the backend; **no** retained originals after upload.
- **Relational** stats (`event_stats`, `activity_stats`); **relational** comparison membership (`comparison_event_activities`); **packed** stream points in `streams.data`.
- Event delete must clear comparisons that reference the event first (service workflow).
- New FKs: `ON DELETE CASCADE` unless unfile semantics apply (`folder_id` → `SET NULL`).
- **New migrations only.** Never edit applied migration files. `backend/sql/schema.sql` is a reference snapshot, not a migration.
- Config only via [`backend/src/config.js`](backend/src/config.js).

## API contract

The full machine-readable API specification is at [`backend/docs/openapi.yaml`](backend/docs/openapi.yaml) (OpenAPI 3.1).

Key points:
- All protected endpoints require a valid session cookie (`ofl.sid`).
- All state-changing requests (POST, PATCH, DELETE) must include the CSRF token in a header (**`CSRF-Token`** or **`x-csrf-token`**). Obtain the value from `GET /api/auth/me`.
- Error responses are always `{ "error": "<message>" }`.
- Missing or unowned resources return `404`, not `403`.
- Response shapes for events and activities are produced by `mapEventRow` and `mapActivityRow` in `backend/src/utils/transforms.js` (imported Strava events include optional `importProvider` / `importExternalId`).

## Conventions

### Backend

- All SQL lives in repositories (`backend/src/repositories/`). Repositories run queries through `runQuery` (multi-row) or `runQueryOne` (first row or `null`) from `repositories/query-helper.js`, which uses `opts.conn` when set, else `opts.db`. Services and routes must not contain SQL.
- Services that touch the DB accept optional injection: `const db = opts?.db ?? defaultDb`, then pass `{ ...opts, db }` to repositories. Use `db.transaction(async (conn) => ...)` for multi-statement atomic writes and pass `{ ...opts, db, conn }` inside it.
- Routes are thin: validate with Express middleware in `backend/src/utils/validation.js`, call a service, return the response. No business logic or DB access in route handlers.
- Input limits (e.g. max `limit`) are enforced in validation middleware, or the server cap is documented in one place so validation and services stay aligned.
- Services that touch the DB must be unit-testable with an injected fake `db` that provides `query`, `queryOne`, and `transaction`, plus `getPool` where used (the contract used by `backend/src/db.js`). Keep `opts` pass-through so tests can substitute it.
- Use the shared `asyncHandler` from `backend/src/middleware/async-handler.js`. Do not redefine it in route files.
- Errors use `ParseError`, `ValidationError`, or `NotFoundError` from `backend/src/errors.js`. The central error handler maps `statusCode` to HTTP status, and API error responses use `{ error: string }`. Do not send ad-hoc error responses.
- API response shapes are built by helpers in `backend/src/utils/transforms.js` (`mapEventRow`, `mapActivityRow`, `aggregateStats`).
- Avoid N+1 queries. Load related data for many parents with batched `IN (...)` queries and placeholders from `placeholders(n)` in `backend/src/repositories/query-helper.js`.
- If a new query needs an index for its filters or `ORDER BY`, add it in a new migration (e.g. `backend/sql/migrations/NNN_description.sql`).
- Do not add circular dependencies. Services must not require other services; routes may require several services. Accepted exception: `event-update-service` imports `event-query-service.getEventById` to build the update response. Prefer repositories for new cross-module access.

### Frontend

- Svelte 5 runes only: `$state()`, `$derived()`, `$effect()`, `$props()`. Do not use legacy `let` reactivity, `$:`, or `export let`.
- Tailwind CSS v4 only. No component-level `<style>` blocks, SCSS, or Sass for layout or colors.
- API calls use `fetch()` in plain `.ts` modules. Work with plain API JSON and TypeScript interfaces. No RxJS or Angular HttpClient.
- Routing uses `svelte-spa-router`, with routes defined in a central config. Navigate with `push()`, `replace()`, and `params`.
- File names: components and routes `kebab-case.svelte`; services and utils `kebab-case.ts` or `camelCase.ts`.
- Icons: `<span class="material-icons">{iconName}</span>` (Material Icons). Custom SVG names are mapped via `getStatIconMaterialName()`.
- Do not use `@sports-alliance/sports-lib` in the frontend.
- Modal dialogs (elements with `role="dialog"` and `aria-modal="true"`) must close on the Escape key. Attach `onkeydown` to the dialog, or to a wrapper that holds focus (`tabindex="-1"`), and call the same close logic as the overlay click and Cancel button: `if (e.key === 'Escape') onClose();`.

## Key entry points

### Backend

- App bootstrap: `backend/src/index.js`
- Auth/session: `backend/src/routes/auth.js`, `backend/src/middleware/session.js`, `backend/src/middleware/require-auth.js`, `backend/src/middleware/passport.js`, `backend/src/middleware/oauth-state.js` (Apple state cookie), `backend/src/session-registry.js` (per-user session tracking/revocation)
- Events: `backend/src/routes/events.js`, `backend/src/services/event-query-service.js`, `backend/src/services/event-upload-service.js`, `backend/src/services/event-persistence.js` (shared persist for uploads + Strava import), `backend/src/services/event-delete-service.js`, `backend/src/middleware/upload-guards.js` (upload size/concurrency guards)
- Comparisons: `backend/src/routes/comparisons.js`, `backend/src/services/comparison-service.js`
- Folders: `backend/src/routes/folders.js`, `backend/src/services/folder-service.js`
- Account: `backend/src/routes/account.js`, `backend/src/services/account-service.js`
- Strava import: `backend/src/routes/integrations-strava.js`, `backend/src/services/strava-integration-service.js`, `backend/src/services/strava-oauth-service.js`, `backend/src/integrations/strava-driver.js`, `backend/src/services/integration-idempotency.js`, shared Valkey client `backend/src/redis-client.js`
- Schema/config: `backend/sql/schema.sql`, `backend/src/config.js`

### Frontend

- App shell and route guard: `frontend/src/App.svelte`
- Auth state and API client: `frontend/src/lib/stores/auth.svelte.ts`, `frontend/src/lib/api/client.ts`
- Folder state: `frontend/src/lib/stores/folders.svelte.ts`
- Routes: `frontend/src/routes/`
- API modules: `frontend/src/lib/api/`
- Shared types: `frontend/src/lib/types/event.ts`

## Documentation

When you change behavior that an authoritative doc describes, update that doc in the same change.

| Change type | Update |
|---|---|
| New or changed REST endpoints, request/response shapes, auth | `backend/docs/openapi.yaml` |
| Schema (migrations) | New migration file only; update `backend/sql/schema.sql` as reference snapshot; update `docs/ARCHITECTURE.md` if it affects documented architecture |
| Config, env, deployment | `docs/ARCHITECTURE.md`, and `backend/README.md` or `frontend/README.md` if they reference it |
| Key commands, invariants, entry points, conventions | `AGENTS.md`, and the relevant README |
| Backend run, test, or config usage | `backend/README.md` |
| Frontend run, test, or build usage | `frontend/README.md` |

## Validation checklist

After meaningful refactors, verify:

1. Login page appears when unauthenticated.
2. Sign-in reaches the dashboard.
3. Uploading a supported file creates an event.
4. Event detail loads stats, charts, and streams.
5. Comparisons list and comparison view still load.
6. Folder-filtered views still behave correctly.
7. Deleting an event removes it cleanly.

For full-stack verification, run `make e2e`. The Playwright suite covers all of the above automatically.

## Non-authoritative files

Do not read, cite, or rely on documents under `implementation_plans/` unless the user explicitly asks to use them, or the task is to create or update an implementation plan. That directory is gitignored working material, not authoritative.

## When unsure

| Topic | Read |
|---|---|
| Which doc to update when code changes | "Documentation" section above |
| Technical reference | `docs/ARCHITECTURE.md` |
| OAuth / Strava integration setup | `docs/INTEGRATIONS_INSTRUCTIONS.md` |
| API contract | `backend/docs/openapi.yaml` |
| API routes | `backend/src/routes/` |
| Auth flow | `backend/src/routes/auth.js`, `backend/src/middleware/session.js`, `backend/src/middleware/require-auth.js` |
| Events and uploads | `backend/src/services/event-query-service.js`, `backend/src/services/event-upload-service.js`, `backend/src/services/event-persistence.js` |
| Comparisons | `backend/src/services/comparison-service.js`, `backend/src/routes/comparisons.js` |
| Folders | `backend/src/services/folder-service.js`, `backend/src/routes/folders.js` |
| Schema | `backend/sql/schema.sql` |
| Backend conventions | "Conventions > Backend" above, `backend/README.md` |
| Frontend conventions | "Conventions > Frontend" above, `frontend/README.md` |
| Deferred dependency upgrades (TypeScript 7 blocked by svelte-check and typescript-eslint) | `frontend/README.md` |
| Frontend data flow | `frontend/src/routes/`, `frontend/src/lib/api/`, `frontend/src/lib/stores/auth.svelte.ts` |
| Package scripts | `backend/package.json`, `frontend/package.json` |

Read source before making assumptions.
