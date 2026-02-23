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
   - **Frontend:** http://localhost:4200 (Svelte/Vite dev server)
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
  - Main: `@sports-alliance/sports-lib`, `express`, `mysql2`, `multer`, `cors`, `xmldom`
  - Install: `cd backend && npm install`

- **Lint and test:**
  - `npm run lint` - Lint src/
  - `npm run lint:fix` - Fix lint issues
  - `npm run format` - Check formatting (Prettier)
  - `npm run format:fix` - Fix formatting
  - `npm run test` - Run all tests (Node test runner)
  - `npm run test:unit` - Run unit tests only (`test/unit/**/*.test.js`)

### Frontend (`frontend/`)

- **Run:**
  - `npm run dev` - Start Vite dev server on port 4200
  - `npm run build` - Production build
  - `npm run preview` - Preview production build locally
  - Requires Node 22+

- **Stack:** Svelte 5, Vite, Tailwind CSS v4, svelte-spa-router

- **Dependencies:**
  - Main: `svelte`, `vite`, `@sveltejs/vite-plugin-svelte`, `tailwindcss`, `svelte-spa-router`, `maplibre-gl`, `svelte-maplibre-gl`, `uplot`
  - Map tiles: OpenFreeMap dark style (https://tiles.openfreemap.org/styles/dark) — no API key required
  - Install: `cd frontend && npm install`

## Project layout and architecture

- **Root structure:**
  - `backend/` - Node.js Express API (from backend/package.json)
  - `frontend/` - Svelte 5 + Vite + Tailwind SPA
  - `docs/` - Documentation files (including `docs/HOSTING.md` for AWS/GCP cloud hosting)
  - `docker-compose.yaml` - Docker Compose configuration

- **Backend structure:**
  - `backend/src/index.js` - Express app entry point
  - `backend/src/db.js` - Database connection and query helpers
  - `backend/src/routes/events.js` - Events API routes
  - `backend/src/routes/comparisons.js` - Comparisons API routes
  - `backend/src/routes/meta.js` - Activity types and devices meta routes
  - `backend/src/services/` - Business logic (event-query-service, event-upload-service, event-delete-service, comparison-service, stream-service, activity-service, meta-service)
  - `backend/src/parsers/file-parser.js` - File parsing (TCX, FIT, GPX, JSON, SML)
  - `backend/src/utils/stream-extractor.js` - Extract timestamped stream data points
  - `backend/src/utils/json-sanitizer.js` - Sanitize sports-lib JSON
  - `backend/sql/schema.sql` - Database schema (runs on startup via `db.initializeSchema()`)

- **Frontend structure:**
  - `frontend/src/lib/` - API modules, types, utils, reusable components
  - `frontend/src/lib/components/RouteMap.svelte` - GPS route map (MapLibre GL + OpenFreeMap dark tiles)
  - `frontend/src/lib/utils/geo.ts` - GeoJSON route builder from Latitude/Longitude or Position streams
  - `frontend/src/routes/` - Page components (Dashboard, EventDetail)
  - `frontend/src/App.svelte` - Layout shell and router
  - `frontend/vite.config.ts` - Vite and Tailwind configuration

- **Database schema:**
  - `events` - Event metadata (id, start_date, name, end_date, description, is_merge, src_file_type, created_at)
  - `event_stats` - Event-level statistics (event_id, stat_type, value JSON)
  - `activities` - Activity metadata (id, event_id, name, start_date, end_date, type, event_start_date, device_name, created_at)
  - `activity_stats` - Activity-level statistics (activity_id, stat_type, value JSON)
  - `streams` - Stream metadata (id, activity_id, event_id, type)
  - `stream_data_points` - Timestamped stream data (id, stream_id, time_ms BIGINT, value JSON, sequence_index)
  - `comparisons` - Saved comparison definitions (id, name, event_ids JSON, settings JSON, created_at)
  - Foreign keys with ON DELETE CASCADE: event_stats → events; activities → events; activity_stats → activities; streams → activities, events; stream_data_points → streams. Deleting an event removes all related rows.
  - Indexes: foreign keys, events.start_date, activities (event_id, type, device_name, start_date), stream_data_points (stream_id, time_ms; stream_id, sequence_index, time_ms for stream fetch order), comparisons.created_at.
  - Schema auto-initializes on API startup via `db.initializeSchema()`

## API endpoints

Full request/response details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

- **GET /api/events** - List events
  - Query params: `startDate` (timestamp), `endDate` (timestamp), `limit` (default 50, max 200)
  - Returns: Array of event objects with `stats` object; optional `srcFileType` when present
  - Example: `GET /api/events?startDate=1771317000000&limit=10`

- **GET /api/events/:id** - Get single event with activities
  - Returns: `{ event: {...}, activities: [...] }`
  - Event includes `stats` object (from `event_stats` table)
  - Activities include `stats` object (from `activity_stats` table)

- **GET /api/events/:id/activities/:activityId/streams** - Get stream data for activity
  - Query params: `types` (optional, filter by stream types)
  - Returns: Array of `{ type: string, data: [{ time: number, value: any }, ...] }`
  - Data points ordered by `sequence_index` and `time_ms`

- **POST /api/events** - Upload and parse file
  - Content-Type: `multipart/form-data`
  - Body: `files` (one or more files: TCX, FIT, GPX, JSON, SML)
  - Backend parses file, extracts event/activities/streams, stores in database
  - Returns: `{ id: string, event: {...}, activities: [...] }`
  - Files are parsed and discarded (not stored)

- **DELETE /api/events/:id** - Delete event
  - Database ON DELETE CASCADE removes event_stats, activities, activity_stats, streams, stream_data_points
  - Returns: 204 No Content or 404 Not Found

## Key architectural decisions

- **File parsing on backend:** Files are uploaded raw, parsed server-side using `@sports-alliance/sports-lib`, then discarded. No file storage.
- **Relational stats storage:** Event and activity statistics stored in separate tables (`event_stats`, `activity_stats`) with one row per stat type, not as JSON blobs.
- **Timestamped stream data:** Stream data stored relationally in `stream_data_points` with `time_ms` (BIGINT UTC milliseconds) and `sequence_index` for ordering.
- **No migrations:** Schema runs on startup via `initializeSchema()`. Schema changes require recreating database.
- **Self-hosted deployment:** Docker Compose is the deployment artifact. No cloud dependencies. Rationale in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Conventions (coding, naming, error handling)

- **Svelte (frontend):** Svelte 5 runes and Tailwind only. See [.cursor/rules/svelte-frontend.mdc](.cursor/rules/svelte-frontend.mdc).

- **JavaScript (backend):** Backend: repositories own SQL; services accept `opts.db` and use transactions for multi-statement writes; routes are thin. See [backend/README.md](backend/README.md) for module map and [.cursor/rules/backend-architecture.mdc](.cursor/rules/backend-architecture.mdc) for full conventions.

- **Database:**
  - MariaDB/MySQL compatible
  - UUIDs stored as VARCHAR(36)
  - Timestamps stored as BIGINT (milliseconds since epoch)
  - JSON columns for flexible data (`value` in event_stats/activity_stats; comparisons.event_ids, comparisons.settings)
  - Foreign keys with ON DELETE CASCADE for event→event_stats, event→activities, activity→activity_stats, activity→streams, event→streams, stream→stream_data_points
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
  - Modify stream data structure without updating `stream-extractor.js` and API endpoints

- **Do:**
  - Use `db.initializeSchema()` to run schema on startup
  - Store stats relationally (one row per stat_type in `event_stats`/`activity_stats`)
  - Store stream data points with timestamps in `stream_data_points` table
  - Parse files on backend, discard after parsing
  - Use UUIDs for event/activity IDs (generated via `randomUUID()`)
  - Return stats nested under `stats` key in API responses
  - Handle JSON parsing for database JSON columns (may be objects or strings)
  - Rely on ON DELETE CASCADE when deleting events (single DELETE FROM events; cascade removes related rows)

- **Database changes:**
  - Schema runs on startup, so changes require recreating database
  - No migration system - document schema changes clearly
  - Test schema changes locally before deploying

## Environment variables

- **Backend:**
  - `PORT` - API port (default: 3000)
  - `DB_HOST` - Database host (default: localhost, or `db` in Docker)
  - `DB_USER` - Database user (default: qs)
  - `DB_PASSWORD` - Database password (default: qspass)
  - `DB_DATABASE` - Database name (default: openfitlab)
  - `UPLOAD_DIR` - Upload directory (default: `backend/uploads/`)

- **Docker Compose:**
  - `MARIADB_ROOT_PASSWORD` - MariaDB root password (default: qsroot)
  - `MARIADB_DATABASE` - Database name (default: openfitlab)
  - `MARIADB_USER` - Database user (default: qs)
  - `MARIADB_PASSWORD` - Database password (default: qspass)

## Smoke test (after refactors)

Run this checklist after each refactoring stage to confirm the app still works.

1. **Upload a .FIT file via dashboard** → Verify event appears in the list.
2. **Click event** → Verify detail page loads with stats + charts.
3. **Navigate to comparisons** → Verify list loads.
4. **DELETE an event** → Verify removal (event disappears from list).
5. **Filter by activity type on dashboard** → Verify filtering works.

## When unsure (how to confirm unknowns; which files to read)

| Topic | File(s) |
|-------|---------|
| API endpoints | `backend/src/routes/events.js`; full details [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Database schema | `backend/sql/schema.sql` |
| Backend conventions | `backend/README.md`, `.cursor/rules/backend-architecture.mdc` |
| Frontend conventions | `.cursor/rules/svelte-frontend.mdc` |
| Frontend API and types | `frontend/src/lib/api/`, `frontend/src/lib/types/` |
| Frontend routes/pages | `frontend/src/routes/` |
| Route map (GPS) | `frontend/src/lib/components/RouteMap.svelte`, `frontend/src/lib/utils/geo.ts` |
| File parsing | `backend/src/parsers/file-parser.js` |
| Stream extraction | `backend/src/utils/stream-extractor.js` |
| Database connection | `backend/src/db.js` |
| Docker setup | `docker-compose.yaml` |
| Package scripts | `backend/package.json`, `frontend/package.json` |
| Frontend build | `frontend/vite.config.ts` |
| Cloud hosting (AWS/GCP) | `docs/HOSTING.md` |

Read relevant source files before making assumptions.
