# AGENTS

## Purpose and scope

This file provides operational instructions for AI coding agents working in this repository. It documents verified commands, conventions, and safety rules derived from the actual codebase. Do not guess or invent workflows—everything here is based on evidence from repository files.

## Quickstart (local dev)

1. **Start the stack:**
   - From `refactoring/` directory: `docker compose up -d`
   - This starts MariaDB (port 3306), API (port 3000), and frontend (port 4200)
   - Services run in dev mode with file watching enabled

2. **Access services:**
   - **API:** http://localhost:3000 (GET `/` or `/health` returns `{ "ok": true }`)
   - **Frontend:** http://localhost:4200 (Angular dev server)
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

### Frontend (`frontend/`)

- **Run:**
  - `npm start` - Start dev server on port 4200 (from frontend/package.json script "start")
  - `npm run start:dev` - Start with development configuration (from frontend/package.json script "start:dev")
  - `npm run start:docker` - Start with Docker proxy config (from frontend/package.json script "start:docker")
  - `npm run build` - Production build (from frontend/package.json script "build")
  - `npm run watch` - Build in watch mode (from frontend/package.json script "watch")
  - Requires Node 22+ (from frontend/package.json engines)

- **Dependencies:**
  - Main: Angular 20, Angular Material, `@sports-alliance/sports-lib`, `rxjs`
  - Install: `cd frontend && npm install`

### Shared (`shared/`)

- TypeScript module used by frontend (and optionally backend)
- Path mapping: `@openfitlab/shared` → `../shared/src` (configured in frontend TypeScript config)
- Contains: `api-event-writer.ts`, `app-event.interface.ts`, `id-generator.ts`

## Project layout and architecture

- **Root structure:**
  - `backend/` - Node.js Express API (from backend/package.json)
  - `frontend/` - Angular application (from frontend/package.json)
  - `shared/` - TypeScript shared module
  - `docs/` - Documentation files
  - `docker-compose.yml` - Docker Compose configuration

- **Backend structure:**
  - `backend/src/index.js` - Express app entry point
  - `backend/src/db.js` - Database connection and query helpers
  - `backend/src/routes/events.js` - Events API routes
  - `backend/src/parsers/file-parser.js` - File parsing (TCX, FIT, GPX, JSON, SML)
  - `backend/src/utils/stream-extractor.js` - Extract timestamped stream data points
  - `backend/src/utils/json-sanitizer.js` - Sanitize sports-lib JSON
  - `backend/sql/schema.sql` - Database schema (runs on startup via `db.initializeSchema()`)

- **Frontend structure:**
  - `frontend/src/app/components/` - Angular components
  - `frontend/src/app/services/` - Angular services
  - `frontend/src/app/components/dashboard/` - Dashboard component
  - `frontend/src/app/components/upload/` - File upload component
  - `frontend/src/app/components/event-detail/` - Event detail view
  - `frontend/angular.json` - Angular configuration

- **Database schema:**
  - `events` - Event metadata (id, start_date, name, privacy, end_date, description, is_merge, payload_rest)
  - `event_stats` - Event-level statistics (event_id, stat_type, value JSON)
  - `activities` - Activity metadata (id, event_id, name, start_date, end_date, type, event_start_date, payload_rest)
  - `activity_stats` - Activity-level statistics (activity_id, stat_type, value JSON)
  - `streams` - Stream metadata (id, activity_id, event_id, type)
  - `stream_data_points` - Timestamped stream data (id, stream_id, time_ms BIGINT, value JSON, sequence_index)
  - `original_files` - File metadata (id, event_id, extension, file_path, start_date, original_filename)
  - No foreign keys (to avoid charset/collation issues)
  - Schema auto-initializes on API startup via `db.initializeSchema()`

## API endpoints

- **GET /api/events** - List events
  - Query params: `startDate` (timestamp), `endDate` (timestamp), `limit` (default 50, max 200)
  - Returns: Array of event objects with `stats` object and `payload_rest` merged
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
  - Cascades: deletes `activity_stats`, `event_stats`, `stream_data_points`, `streams`, `activities`, `original_files`, then `events`
  - Returns: 204 No Content or 404 Not Found

## Key architectural decisions

- **File parsing on backend:** Files are uploaded raw, parsed server-side using `@sports-alliance/sports-lib`, then discarded. No file storage.
- **Relational stats storage:** Event and activity statistics stored in separate tables (`event_stats`, `activity_stats`) with one row per stat type, not as JSON blobs.
- **Timestamped stream data:** Stream data stored relationally in `stream_data_points` with `time_ms` (BIGINT UTC milliseconds) and `sequence_index` for ordering.
- **No migrations:** Schema runs on startup via `initializeSchema()`. Schema changes require recreating database.
- **Self-hosted deployment:** Docker Compose is the deployment artifact. No cloud dependencies.

## Conventions (coding, naming, error handling)

- **TypeScript (frontend/shared):**
  - Angular 20 with standalone components
  - Component selector prefix: `app` (from angular.json)
  - Uses Angular Material for UI components
  - Path mapping: `@openfitlab/shared` for shared module

- **JavaScript (backend):**
  - Node.js 24+ with CommonJS modules
  - Express.js for HTTP server
  - MySQL2 with connection pooling
  - No TypeScript in backend (plain JavaScript)

- **Database:**
  - MariaDB/MySQL compatible
  - UUIDs stored as VARCHAR(36)
  - Timestamps stored as BIGINT (milliseconds since epoch)
  - JSON columns for flexible data (`payload_rest`, `value` in stats tables)
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
  - Add foreign key constraints (avoid charset/collation issues)
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

## When unsure (how to confirm unknowns; which files to read)

- **API endpoints:** Check `backend/src/routes/events.js`
- **Database schema:** Check `backend/sql/schema.sql`
- **File parsing:** Check `backend/src/parsers/file-parser.js`
- **Stream extraction:** Check `backend/src/utils/stream-extractor.js`
- **Database connection:** Check `backend/src/db.js`
- **Frontend services:** Check `frontend/src/app/services/`
- **Frontend components:** Check `frontend/src/app/components/`
- **Shared utilities:** Check `shared/src/`
- **Docker setup:** Check `docker-compose.yml`
- **Package scripts:** Check `backend/package.json` and `frontend/package.json`
- **Angular config:** Check `frontend/angular.json`
- **Unknown:** Read relevant source files before making assumptions
