# AGENTS

## Purpose and scope

**Role:** Fast AI-agent entrypoint. Use this file for operational context, safety rules, and where to look next. Deep technical reference lives in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Product intent lives in [docs/PRD.md](docs/PRD.md).

## Quickstart

1. Start the local stack from the repo root with `docker compose up -d`.
2. Services:
   - API: `http://localhost:3000`
   - Frontend: `http://localhost:4200`
   - MariaDB: `localhost:3306`
   - Adminer: `http://localhost:8080`
3. Stop with `docker compose down` or `docker compose down -v` to remove volumes.

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

## Agent-critical invariants

- Authentication is server-side session auth with OAuth providers and a Valkey-backed session store. Do not introduce JWT or localStorage auth.
- State-changing requests require the CSRF token returned by `GET /api/auth/me`.
- All event, comparison, folder, and derived meta queries must be scoped by authenticated ownership using `req.userId`.
- Return `404` for missing or not-owned resources by ID to avoid leaking existence.
- Files are parsed on the backend and discarded. Do not store originals after upload.
- Stats stay relational in `event_stats` and `activity_stats`. Do not collapse them into JSON blobs.
- Stream points stay relational in `stream_data_points` with `time_ms` and `sequence_index`.
- Comparison membership stays relational in `comparison_event_activities`.
- Deleting an event must remove comparisons that reference it before the event delete completes.
- Schema is defined in `backend/sql/schema.sql` and applied on startup. There are no migrations; schema changes require DB recreation.
- Backend configuration must come from `backend/src/config.js`, not direct `process.env` reads elsewhere.

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
