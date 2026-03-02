# AGENTS

## Purpose and scope

This file provides operational instructions for AI coding agents working in this repository. It documents verified commands, conventions, and safety rules derived from the actual codebase. Do not guess or invent workflows—everything here is based on evidence from repository files.

## Quickstart (local dev)

1. **Start the stack:**
   - From project root: `docker compose up -d`
   - This starts MariaDB (port 3306), API (port 3000), and frontend (port 4200)
   - Services run in dev mode with file watching enabled

2. **Access services:**
   - **API:** http://localhost:3000 (GET `/` or `/health` returns `{ "ok": true }`)
   - **Frontend:** http://localhost:4200 (Svelte/Vite dev server). **Authentication required:** unauthenticated users see the login page; sign in with Google or GitHub (OAuth must be configured in `.env`).
   - **Database:** MariaDB on `localhost:3306` (default user: `qs`, password: `qspass`, database: `openfitlab`)
   - **Adminer:** http://localhost:8080 (database admin UI)

3. **Stop the stack:**
   - `docker compose down` (keeps data volumes)
   - `docker compose down -v` (removes volumes, deletes data)

## Commands (build, run, test, lint)

### Backend (`backend/`)

- **Run:**
  - `npm start` - Start production server (from backend/package.json script "start")
  - `npm run dev` - Start with file watching (from backend/package.json script "dev")
  - Requires Node 24+ (from backend/package.json engines)

- **Dependencies:**
  - Main: `@sports-alliance/sports-lib`, `express`, `mysql2`, `multer`, `cors`, `xmldom`, `passport`, `passport-google-oauth20`, `passport-github2`, `express-session`, `express-mysql-session`, `helmet`, `express-rate-limit`
  - Install: `cd backend && npm install`

- **Lint and test:**
  - `npm run lint` - Lint src/
  - `npm run lint:fix` - Fix lint issues
  - `npm run format` - Check formatting (Prettier)
  - `npm run format:fix` - Fix formatting
  - `npm run test` - Run all tests (Node test runner)
  - `npm run test:unit` - Run unit tests only (`test/unit/**/*.test.js`)
  - `npm run test:coverage` - Run unit tests with coverage (terminal summary; uses `--experimental-test-coverage`)
  - `npm run test:coverage:lcov` - Same plus LCOV file at `coverage/lcov.info` (for CI/IDEs; `coverage/` is gitignored)
  - To verify Node 24 compatibility, run tests with `NODE_OPTIONS='--throw-deprecation' npm run test:unit` so deprecations fail the build.

### Frontend (`frontend/`)

- **Run:**
  - `npm run dev` - Start Vite dev server on port 4200
  - `npm run build` - Production build
  - `npm run preview` - Preview production build locally
  - Requires Node 20+

- **Stack:** Svelte 5, Vite, Tailwind CSS v4, svelte-spa-router

- **Dependencies:**
  - Main: `svelte`, `vite`, `@sveltejs/vite-plugin-svelte`, `tailwindcss`, `svelte-spa-router`, `maplibre-gl`, `svelte-maplibre-gl`, `uplot`
  - Map tiles: OpenFreeMap dark style (https://tiles.openfreemap.org/styles/dark) — no API key required
  - Install: `cd frontend && npm install`

- **Lint and test:**
  - `npm run format` / `npm run format:fix` — Prettier check/write for `src/**/*.{ts,svelte,css,json}`
  - `npm run lint` / `npm run lint:fix` — ESLint on src/
  - `npm run check` — svelte-check (tsconfig.app.json) + tsc (tsconfig.node.json)
  - `npm run test` — Vitest (all tests); `npm run test:watch`; `npm run test:coverage` (coverage report in terminal and under `coverage/` as HTML and LCOV; `coverage/` is gitignored); `npm run test:coverage:ci` — same for CI
  - `npm run ci` — format → lint → check → test → build (single gate for pre-commit or CI)

## CI (GitHub Actions)

On **push to main** and **pull_request** targeting main:

- **Backend checks** (when `backend/**` or `.github/workflows/backend-checks.yml` change): lint, format, test:unit, test:unit with `NODE_OPTIONS='--throw-deprecation'`, and test:coverage. See [.github/workflows/backend-checks.yml](.github/workflows/backend-checks.yml).
- **Frontend checks** (when `frontend/**` or `.github/workflows/frontend-checks.yml` change): format, lint, check, test with coverage, build. See [.github/workflows/frontend-checks.yml](.github/workflows/frontend-checks.yml).

## Project layout and architecture

- **Root structure:**
  - `backend/` - Node.js Express API (from backend/package.json)
  - `frontend/` - Svelte 5 + Vite + Tailwind SPA
  - `docs/` - Documentation files (including `docs/HOSTING.md` for AWS/GCP cloud hosting)
  - `docker-compose.yaml` - Docker Compose configuration

- **Backend structure:**
  - `backend/src/index.js` - Express app entry point (session, passport, auth routes public; events/comparisons/meta/account behind requireAuth)
  - `backend/src/db.js` - Database connection and query helpers
  - `backend/src/routes/events.js` - Events API routes (require auth; scoped by user)
  - `backend/src/routes/comparisons.js` - Comparisons API routes (require auth; scoped by user)
  - `backend/src/routes/meta.js` - Activity types and devices meta routes (require auth; scoped by user)
  - `backend/src/routes/auth.js` - Auth routes (OAuth init/callback, GET /api/auth/me, POST /api/auth/logout)
  - `backend/src/routes/account.js` - Account routes (GET /api/account/export, DELETE /api/account)
  - `backend/src/services/` - Business logic (event-query-service, event-upload-service, event-delete-service, comparison-service, stream-service, activity-service, meta-service, account-service)
  - `backend/src/repositories/user-repository.js` - User and identity CRUD; findOrCreateByIdentity for OAuth
  - `backend/src/middleware/session.js` - express-session + MySQL store
  - `backend/src/middleware/require-auth.js` - Require valid session; set req.userId
  - `backend/src/middleware/passport.js` - Passport strategies (Google, GitHub)
  - `backend/src/parsers/file-parser.js` - File parsing (TCX, FIT, GPX, JSON, SML)
  - `backend/src/utils/stream-extractor.js` - Extract timestamped stream data points
  - `backend/src/utils/json-sanitizer.js` - Sanitize sports-lib JSON
  - `backend/sql/schema.sql` - Database schema (runs on startup via `db.initializeSchema()`)

- **Frontend structure:**
  - `frontend/src/lib/` - API modules, types, utils, reusable components
  - `frontend/src/lib/components/RouteMap.svelte` - GPS route map (MapLibre GL + OpenFreeMap dark tiles)
  - `frontend/src/lib/utils/geo.ts` - GeoJSON route builder from Latitude/Longitude or Position streams
  - `frontend/src/routes/` - Page components (Dashboard, EventDetail, login, comparisons, comparison-view)
  - `frontend/src/lib/stores/auth.ts` - Auth state (currentUser, checkAuth); used by App.svelte for route guard
  - `frontend/src/lib/api/client.ts` - apiFetch wrapper with credentials and 401 handling
  - `frontend/src/App.svelte` - Layout shell, router, auth guard (login page when unauthenticated), user menu in sidebar
  - `frontend/vite.config.ts` - Vite and Tailwind configuration
  - `frontend/src/test/` - setup.ts, fixtures/ (event-detail, activity-rows, streams, comparisons)
  - Tests: `src/lib/api/__tests__/`, `src/lib/utils/__tests__/`, `src/lib/components/__tests__/`, `src/routes/__tests__/`

- **Database schema:**
  - `users` - User profile (id UUID, display_name, avatar_url, created_at, updated_at). No email on users; email lives in user_identities.
  - `user_identities` - OAuth identities (id, user_id, provider, provider_user_id, email, profile_data JSON). Unique (provider, provider_user_id). FK to users ON DELETE CASCADE.
  - `sessions` - express-session store (session_id, expires, data). Managed by express-mysql-session.
  - `events` - Event metadata (id, user_id, start_date, name, end_date, description, is_merge, src_file_type, created_at). FK to users ON DELETE CASCADE.
  - `event_stats` - Event-level statistics (event_id, stat_type, value JSON)
  - `activities` - Activity metadata (id, event_id, name, start_date, end_date, type, event_start_date, device_name, created_at)
  - `activity_stats` - Activity-level statistics (activity_id, stat_type, value JSON)
  - `streams` - Stream metadata (id, activity_id, event_id, type)
  - `stream_data_points` - Timestamped stream data (id, stream_id, time_ms BIGINT, value JSON, sequence_index)
  - `comparisons` - Saved comparison definitions (id, user_id, name, settings JSON, created_at). Event membership is in `comparison_events`. FK to users ON DELETE CASCADE.
  - `comparison_events` - Link table (comparison_id, event_id) with FK to comparisons ON DELETE CASCADE and FK to events ON DELETE CASCADE. Event IDs for a comparison are stored here, not as JSON.
  - Foreign keys with ON DELETE CASCADE: user_identities → users; event_stats → events; activities → events; activity_stats → activities; streams → activities, events; stream_data_points → streams; comparison_events → comparisons, events; events → users; comparisons → users. Deleting a user cascades to identities, events (and their stats, activities, streams, stream_data_points), and comparisons (and comparison_events). Deleting an event: event-delete-service deletes comparisons that reference it (in a transaction), then deletes the event; CASCADE removes related rows.
  - Indexes: foreign keys; users (id); user_identities (user_id, uk_provider_identity); sessions (expires); events (user_id, start_date, idx_user_start_date); activities (event_id, type, device_name, start_date); stream_data_points (stream_id, time_ms; stream_id, sequence_index, time_ms); comparisons (user_id, created_at); comparison_events (event_id).
  - Schema auto-initializes on API startup via `db.initializeSchema()`

## API endpoints

Full request/response details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**Authentication:** All endpoints under `/api/events`, `/api/comparisons`, `/api/activity-types`, `/api/devices`, and `/api/account` require a valid session (cookie set after OAuth login). Unauthenticated requests return 401. Data is scoped to the authenticated user (`req.userId`).

**Auth and account (public or session):**
- **GET /api/auth/google** - Redirect to Google OAuth consent (no auth)
- **GET /api/auth/google/callback** - Google OAuth callback → create/find user, set session, redirect to SPA (no auth)
- **GET /api/auth/github** - Redirect to GitHub OAuth consent (no auth)
- **GET /api/auth/github/callback** - GitHub OAuth callback (no auth)
- **GET /api/auth/me** - Return current user `{ id, displayName, avatarUrl }` or 401
- **POST /api/auth/logout** - Destroy session, clear cookie
- **GET /api/account/export** - Export all user data as JSON (query `?includeStreams=true` optional)
- **DELETE /api/account** - Delete the current user's account and all data; clears session; 204 on success, 404 if user not found

**Data endpoints (all require auth; scoped by user):**
- **GET /api/events** - List events (simple list; only current user's events)
  - Query params: `startDate` (timestamp), `endDate` (timestamp), `limit` (default 50, max 200)
  - Returns: Array of event objects with `stats` object; optional `srcFileType` when present
  - Example: `GET /api/events?startDate=1771317000000&limit=10`

- **GET /api/events/activity-rows** - Paginated activity-centric list (primary for dashboard)
  - Query params: `limit`, `offset`, `startDate`, `endDate` (timestamps), `activityTypes` (repeatable), `devices` (repeatable), `search` (string)
  - Returns: `{ rows: Array<{ event, activity }>, total: number }`; each event/activity includes `stats`
  - Used by dashboard for table with filters and pagination

- **GET /api/events/:id** - Get single event with activities
  - Returns: `{ event: {...}, activities: [...] }`
  - Event includes `stats` object (from `event_stats` table)
  - Activities include `stats` object (from `activity_stats` table)

- **GET /api/events/:id/candidates** - Events overlapping in time (for comparison picker)
  - Returns: Array of event objects with `stats` (same shape as list); 404 if event not found

- **GET /api/events/:id/activities/:activityId/streams** - Get stream data for activity
  - Query params: `types` (optional, filter by stream types)
  - Returns: Array of `{ type: string, data: [{ time: number, value: any }, ...] }`
  - Data points ordered by `sequence_index` and `time_ms`

- **PATCH /api/events/:id/activities/:activityId** - Update activity
  - Body: `{ type?: string, deviceName?: string }` (at least one required)
  - Returns: Updated activity object; 404 if not found

- **POST /api/events** - Upload and parse files (1–10 per request); response `{ results: [...] }` per file
  - Content-Type: `multipart/form-data`
  - Body: `files` (one or more files: TCX, FIT, GPX, JSON, SML)
  - Backend parses file, extracts event/activities/streams, stores in database
  - Returns: `{ id: string, event: {...}, activities: [...] }`
  - Files are parsed and discarded (not stored)

- **DELETE /api/events/:id** - Delete event
  - In a transaction: deletes any comparisons that reference this event (via comparison_events), then deletes the event. Database ON DELETE CASCADE removes event_stats, activities, activity_stats, streams, stream_data_points, and comparison_events rows.
  - Returns: 204 No Content or 404 Not Found

- **GET /api/activity-types** - Distinct activity types from current user's activities (for filters/editors)
  - Returns: Array of strings

- **GET /api/devices** - Distinct device names from current user's activities (for filters/editors)
  - Returns: Array of strings

- **GET /api/comparisons** - List saved comparisons
  - Returns: Array of `{ id, name, eventIds, settings?, createdAt? }` (createdAt in ms; eventIds from comparison_events)

- **POST /api/comparisons/by-events** - Find comparisons linked to any of the given event IDs (e.g. for delete warnings)
  - Body: `{ eventIds: string[] }` (non-empty array of UUIDs)
  - Returns: Array of `{ id, name, createdAt? }` (lightweight, no eventIds list)

- **GET /api/comparisons/:id** - Get one comparison
  - Returns: `{ id, name, eventIds, settings?, createdAt? }`; 404 if not found

- **POST /api/comparisons** - Create comparison
  - Body: `{ name: string, eventIds: string[], settings?: object }`
  - Returns: 201 with created comparison (same shape)

- **DELETE /api/comparisons/:id** - Delete comparison
  - Returns: 204 No Content or 404 Not Found

## Key architectural decisions

- **Authentication:** Backend-managed OAuth (Google, GitHub) with server-side session cookies (express-session, MySQL store). Session is HttpOnly, Secure in production, SameSite=Lax. No JWTs in localStorage. SPA calls `GET /api/auth/me` on load; all data endpoints require auth and are scoped by `req.userId`. Implementation plan: [implementation_plans/authentication.md](implementation_plans/authentication.md).
- **File parsing on backend:** Files are uploaded raw, parsed server-side using `@sports-alliance/sports-lib`, then discarded. No file storage.
- **Relational stats storage:** Event and activity statistics stored in separate tables (`event_stats`, `activity_stats`) with one row per stat type, not as JSON blobs.
- **Timestamped stream data:** Stream data stored relationally in `stream_data_points` with `time_ms` (BIGINT UTC milliseconds) and `sequence_index` for ordering.
- **Per-user data:** Only `events` and `comparisons` have `user_id`; all other data is owned via FK chain. Every query for events/comparisons (and meta derived from events) filters by `user_id`; IDOR prevention by returning 404 when resource is not owned.
- **No migrations:** Schema runs on startup via `initializeSchema()`. Schema changes require recreating database.
- **Self-hosted deployment:** Docker Compose is the deployment artifact. No cloud dependencies. Rationale in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Conventions (coding, naming, error handling)

- **Svelte (frontend):** Svelte 5 runes and Tailwind only. See [.cursor/rules/svelte-frontend.mdc](.cursor/rules/svelte-frontend.mdc).

- **JavaScript (backend):** Backend: repositories own SQL; services accept `opts.db` and use transactions for multi-statement writes; routes are thin. See [backend/README.md](backend/README.md) for module map and [.cursor/rules/backend-architecture.mdc](.cursor/rules/backend-architecture.mdc) for full conventions.

- **Database:**
  - MariaDB/MySQL compatible
  - UUIDs stored as VARCHAR(36)
  - Timestamps stored as BIGINT (milliseconds since epoch)
  - JSON columns for flexible data (`value` in event_stats/activity_stats; comparisons.settings). Comparison–event links are relational in `comparison_events`, not JSON.
  - Foreign keys with ON DELETE CASCADE for event→event_stats, event→activities, activity→activity_stats, activity→streams, event→streams, stream→stream_data_points, comparison_events→comparisons and →events
  - Indexes on foreign key columns and time ranges

- **API responses:**
  - JSON format
  - Event/activity stats nested under `stats` key (object mapping stat_type → value)
  - Timestamps in responses are numbers (milliseconds), not Date objects
  - Error responses: `{ error: string }` with appropriate HTTP status codes

- **File parsing:**
  - Supports: TCX, FIT, GPX, JSON (Suunto), SML (Suunto)
  - Handles gzip compression automatically
  - Uses `@sports-alliance/sports-lib` for parsing
  - Event name derived from filename (without extension)

## Safety rules for agents

- **Do NOT:**
  - Modify `backend/sql/schema.sql` without understanding it will require recreating the database
  - Store original files after parsing (they should be discarded)
  - Change API response format without updating frontend
  - Break the relational stats structure (use `event_stats`/`activity_stats` tables, not JSON blobs)
  - Store comparison event membership as JSON; use the `comparison_events` link table
  - Modify stream data structure without updating `stream-extractor.js` and API endpoints
  - Omit `user_id` (or `userId` in opts) from any query that reads or writes events or comparisons; every such query must scope by the authenticated user to prevent IDOR/data leak
  - Trust `user_id` or resource ownership from request body or URL params; use only `req.userId` from requireAuth middleware

- **Do:**
  - Use `db.initializeSchema()` to run schema on startup
  - Store stats relationally (one row per stat_type in `event_stats`/`activity_stats`)
  - Store stream data points with timestamps in `stream_data_points` table
  - Parse files on backend, discard after parsing
  - Use UUIDs for event/activity IDs (generated via `randomUUID()`)
  - Return stats nested under `stats` key in API responses
  - Handle JSON parsing for database JSON columns (may be objects or strings)
  - When deleting an event: delete comparisons that reference it first (event-delete-service does this in a transaction), then delete the event; CASCADE removes related rows (event_stats, activities, streams, comparison_events, etc.)
  - Pass `userId` from `req.userId` into all services/repositories that list, create, or access events or comparisons; enforce ownership (e.g. `WHERE user_id = ?`) so users only see their own data
  - Return 404 (not 403) when a resource by ID is not found or not owned, to avoid leaking existence

- **Database changes:**
  - Schema runs on startup, so changes require recreating database
  - No migration system - document schema changes clearly
  - Test schema changes locally before deploying

## Environment variables

- **Backend:** All backend environment variables are read only in [backend/src/config.js](backend/src/config.js); that file is the single source of truth for env names and defaults. Other backend code must use the config module, not `process.env`.
  - `PORT` - API port (default: 3000)
  - `DB_HOST` - Database host (default: localhost, or `db` in Docker)
  - `DB_USER` - Database user (default: qs)
  - `DB_PASSWORD` - Database password (default: qspass)
  - `DB_DATABASE` - Database name (default: openfitlab)
  - `UPLOAD_DIR` - Upload directory (default: `backend/uploads/`)
  - `SESSION_SECRET` - **Required** for session signing. Generate with `openssl rand -hex 32`. No default; server refuses to start if missing or too short.
  - `OAUTH_CALLBACK_URL` - Base URL for OAuth callbacks (e.g. `http://localhost:3000` in dev or `https://your-domain.com` in production). Used to build redirect_uri for providers.
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth (optional; if set, Google sign-in is enabled)
  - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` - GitHub OAuth (optional; if set, GitHub sign-in is enabled)
  - **Rate limiting (optional; all default if unset):** `API_RATE_LIMIT_MAX`, `API_RATE_LIMIT_WINDOW_MS`; `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MS`; `AUTH_CALLBACK_RATE_LIMIT_MAX`, `AUTH_CALLBACK_RATE_LIMIT_WINDOW_MS`; `UPLOAD_RATE_LIMIT_MAX`, `UPLOAD_RATE_LIMIT_WINDOW_MS`. Defaults: API 100/60000; AUTH 10/900000; AUTH_CALLBACK 20/900000; UPLOAD 30/900000. See [backend/src/config.js](backend/src/config.js) for defaults.
  - **Production:** `NODE_ENV=production`, `ALLOWED_ORIGINS` (comma-separated list for CORS).

- **Frontend (Vite build-time; optional):**
  - `VITE_UPLOAD_CHUNK_SIZE` - Files per upload batch (1–10; default 5). Backend accepts up to 10 per request.

- **Docker Compose:**
  - `MARIADB_ROOT_PASSWORD` - MariaDB root password (default: qsroot)
  - `MARIADB_DATABASE` - Database name (default: openfitlab)
  - `MARIADB_USER` - Database user (default: qs)
  - `MARIADB_PASSWORD` - Database password (default: qspass)

## Smoke test (after refactors)

Run this checklist after each refactoring stage to confirm the app still works.

1. **Open app** → Unauthenticated: login page; sign in with Google or GitHub → dashboard.
2. **Upload a .FIT file via dashboard** → Verify event appears in the list.
3. **Click event** → Verify detail page loads with stats + charts.
4. **Navigate to comparisons** → Verify list loads.
5. **DELETE an event** → Verify removal (event disappears from list).
6. **Filter by activity type on dashboard** → Verify filtering works.
7. **Multi-user isolation (optional):** Second browser/profile, sign in with different provider → empty dashboard; cannot see first user's events.

## Frontend API surface

- **`frontend/src/lib/api/client.ts`**: `apiFetch()` wrapper; all API calls use it (or equivalent with `credentials: 'include'`). Handles 401 by clearing auth state so user is shown login page.
- **`frontend/src/lib/api/account.ts`**: `deleteAccount()` for DELETE /api/account. Used by account.svelte. Uses apiFetch.
- **`frontend/src/lib/api/events.ts`**: Used by dashboard (getActivityRows, getActivityTypes, getDevices, uploadFiles, deleteEvent), event-detail (getEvent, getStreams, getActivityTypes, getDevices, updateActivity), comparison-view (getEvent, getStreams). Uses apiFetch.
- **`frontend/src/lib/api/comparisons.ts`**: Used by dashboard (getComparisonCandidates, getComparisonsByEventIds), comparisons.svelte (getComparisons, deleteComparison), comparison-view (getComparison, createComparison, deleteComparison). Uses apiFetch.
- **`frontend/src/lib/stores/auth.ts`**: Auth state (currentUser, authChecked, authLoading, checkAuth, logout). Consumed by App.svelte for route guard and user menu.
- Types: `frontend/src/lib/types/event.ts` (and re-exported from `lib/types/index.ts`).

## When unsure (how to confirm unknowns; which files to read)

| Topic | File(s) |
|-------|---------|
| API endpoints | `backend/src/routes/events.js`, `backend/src/routes/comparisons.js`, `backend/src/routes/meta.js`, `backend/src/routes/auth.js`, `backend/src/routes/account.js`; full details [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Auth (backend) | `backend/src/routes/auth.js`, `backend/src/middleware/require-auth.js`, `backend/src/middleware/session.js`, `backend/src/middleware/passport.js`, `backend/src/repositories/user-repository.js` |
| Auth (frontend) | `frontend/src/lib/stores/auth.ts`, `frontend/src/lib/api/client.ts`, `frontend/src/routes/login.svelte`, `frontend/src/App.svelte` |
| Database schema | `backend/sql/schema.sql` |
| Backend conventions | `backend/README.md`, `.cursor/rules/backend-architecture.mdc` |
| Frontend conventions | `.cursor/rules/svelte-frontend.mdc` |
| Frontend API and types | `frontend/src/lib/api/`, `frontend/src/lib/types/` |
| Frontend routes/pages | `frontend/src/routes/` |
| Frontend list data (dashboard) | `frontend/src/lib/api/events.ts` (getActivityRows), `frontend/src/routes/dashboard.svelte` |
| Frontend comparison flow | `frontend/src/routes/comparison-view.svelte`, `frontend/src/lib/api/comparisons.ts` |
| Account / delete account | `frontend/src/routes/account.svelte`, `frontend/src/lib/api/account.ts` |
| Route map (GPS) | `frontend/src/lib/components/RouteMap.svelte`, `frontend/src/lib/utils/geo.ts` |
| File parsing | `backend/src/parsers/file-parser.js` |
| Stream extraction | `backend/src/utils/stream-extractor.js` |
| Backend config (env) | `backend/src/config.js` — single place that reads process.env |
| Database connection | `backend/src/db.js` |
| Docker setup | `docker-compose.yaml` |
| Package scripts | `backend/package.json`, `frontend/package.json` |
| Frontend build | `frontend/vite.config.ts` |
| Frontend lint, test, quality gate | `.cursor/rules/frontend-lint-test.mdc`, `frontend/package.json` |
| Cloud hosting (AWS/GCP) | `docs/HOSTING.md` |

Read relevant source files before making assumptions.
