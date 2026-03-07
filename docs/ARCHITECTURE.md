# Architecture Documentation

**Role:** Canonical technical reference for schema, API contracts, security, and architectural decisions. Agent quickstart and commands live in [AGENTS.md](../AGENTS.md). Product intent lives in [docs/PRD.md](PRD.md).

## System overview

OpenFitLab is a self-hosted fitness activity tracking app with:

- a Svelte frontend on port `4200`
- an Express API on port `3000`
- a MariaDB database on port `3306`
- Valkey-backed server sessions

Core flow:

1. The user signs in with Google or GitHub OAuth.
2. The API creates a server-side session and returns CSRF tokens from `GET /api/auth/me`.
3. The user uploads activity files.
4. The backend parses the files (TCX, FIT, GPX, JSON, SML via `@sports-alliance/sports-lib`), stores relational event/activity/stream data, and discards the originals.
5. The frontend reads event, stream, comparison, folder, and account data through authenticated API calls.

## Configuration and runtime

- Backend config is read only from `backend/src/config.js`.
- Schema is defined in `backend/sql/schema.sql` and applied on startup via `db.initializeSchema()`.
- There is no migration system. Schema changes require database recreation.
- Local development uses `docker compose up -d`.

## Data model

### Core concepts

- **Event**: top-level workout session created from an uploaded file.
- **Activity**: sport segment within an event.
- **Stream**: time-series data for an activity, such as heart rate or cadence.
- **Comparison**: saved selection of activities across events.
- **Folder**: user-owned organization unit for events and comparisons.

### Storage rules

- Event stats live in `event_stats`.
- Activity stats live in `activity_stats`.
- Stream points live in `stream_data_points` with `time_ms` and `sequence_index`.
- Comparison membership is relational in `comparison_event_activities`.
- Sessions are stored in Valkey, not in MariaDB.

### Tables

```mermaid
erDiagram
    USERS ||--o{ USER_IDENTITIES : has
    USERS ||--o{ FOLDERS : owns
    USERS ||--o{ EVENTS : owns
    USERS ||--o{ COMPARISONS : owns
    FOLDERS ||--o{ EVENTS : contains
    FOLDERS ||--o{ COMPARISONS : contains
    EVENTS ||--o{ EVENT_STATS : has
    EVENTS ||--o{ ACTIVITIES : contains
    EVENTS ||--o{ STREAMS : has
    ACTIVITIES ||--o{ ACTIVITY_STATS : has
    ACTIVITIES ||--o{ STREAMS : has
    STREAMS ||--o{ STREAM_DATA_POINTS : contains
    COMPARISONS ||--o{ COMPARISON_EVENT_ACTIVITIES : has
    EVENTS ||--o{ COMPARISON_EVENT_ACTIVITIES : referenced_by
    ACTIVITIES ||--o{ COMPARISON_EVENT_ACTIVITIES : referenced_by

    USERS {
        varchar36 id PK
        varchar display_name
        varchar avatar_url
        timestamp created_at
        timestamp updated_at
    }

    USER_IDENTITIES {
        varchar36 id PK
        varchar36 user_id FK
        varchar provider
        varchar provider_user_id
        varchar email
        json profile_data
        timestamp created_at
    }

    FOLDERS {
        varchar36 id PK
        varchar36 user_id FK
        varchar name
        varchar color
        tinyint pinned
        timestamp created_at
    }

    EVENTS {
        varchar36 id PK
        varchar36 user_id FK
        varchar36 folder_id FK
        bigint start_date
        varchar name
        bigint end_date
        text description
        tinyint is_merge
        varchar src_file_type
        varchar start_timezone
        varchar end_timezone
        timestamp created_at
    }

    EVENT_STATS {
        varchar36 event_id PK_FK
        varchar stat_type PK
        json value
    }

    ACTIVITIES {
        varchar36 id PK
        varchar36 event_id FK
        varchar name
        bigint start_date
        bigint end_date
        varchar type
        varchar device_name
        varchar start_timezone
        varchar end_timezone
        timestamp created_at
    }

    ACTIVITY_STATS {
        varchar36 activity_id PK_FK
        varchar stat_type PK
        json value
    }

    STREAMS {
        varchar128 id PK
        varchar36 activity_id FK
        varchar36 event_id FK
        varchar type
        timestamp created_at
    }

    STREAM_DATA_POINTS {
        bigint id PK
        varchar128 stream_id FK
        bigint time_ms
        json value
        int sequence_index
    }

    COMPARISONS {
        varchar36 id PK
        varchar36 user_id FK
        varchar36 folder_id FK
        varchar name
        json settings
        timestamp created_at
    }

    COMPARISON_EVENT_ACTIVITIES {
        varchar36 comparison_id PK_FK
        varchar36 event_id PK_FK
        varchar36 activity_id FK
    }
```

### Ownership and cascade behavior

- `users` own `folders`, `events`, and `comparisons`.
- Most child data is owned through foreign keys and uses `ON DELETE CASCADE`.
- `events.folder_id` and `comparisons.folder_id` use `ON DELETE SET NULL` so folder deletion can unfile content.
- Deleting an event is a service-level workflow: comparisons referencing the event are deleted first, then the event delete cascades remaining child rows.

## API design

### Common behavior

- Protected routes require a valid session and are scoped to the authenticated user.
- Resource ownership is enforced with `req.userId`; request bodies do not decide ownership.
- Missing or not-owned resources return `404`.
- State-changing requests require `CSRF-Token` or `X-CSRF-Token`.
- JSON responses use millisecond timestamps.
- Error responses use `{ error: string }` with the appropriate HTTP status code.
- Backend error classes (`ParseError`, `ValidationError`, `NotFoundError` in `backend/src/errors.js`) set `statusCode`; the central error handler maps it to the HTTP response.

### Health

- `GET /`
- `GET /health`

Both return `{ ok: true }`.

### Authentication and account

- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `GET /api/auth/github`
- `GET /api/auth/github/callback`

OAuth callbacks either:

- create a normal authenticated session and redirect to the SPA, or
- create a temporary pending-signup session and redirect the SPA to signup completion

**Account linking:** when a user signs in with a new provider whose verified email matches an existing identity, the new identity is linked to the existing user automatically. No separate linking UI exists.

Other auth endpoints:

- `GET /api/auth/me`
  - authenticated response: `{ id, displayName, avatarUrl, csrfToken }`
  - pending-signup response: `{ pendingSignup: true, profile, csrfToken }`
  - unauthenticated response: `401`
- `POST /api/auth/logout`
- `POST /api/auth/complete-signup`
- `POST /api/auth/decline-signup`

Account endpoints:

- `GET /api/account/export?includeStreams=true`
- `DELETE /api/account`

### Events

- `GET /api/events`
  - filters: `startDate`, `endDate`, `limit`, `folderId`
  - returns event summaries with `stats`, optional `srcFileType`, optional timezones, and `folderId`
- `GET /api/events/activity-rows`
  - filters: `limit`, `offset`, `startDate`, `endDate`, `activityTypes`, `devices`, `search`, `folderId`
  - returns `{ rows, total }` where each row is `{ event, activity }`
- `GET /api/events/:id`
  - returns `{ event, activities }`
- `GET /api/events/:id/candidates?sameFolderOnly=true|false`
  - returns comparison candidates for the source event
- `POST /api/events`
  - multipart upload field: `files` (1-10 files; TCX, FIT, GPX, JSON, SML)
  - optional body field: `folderId`
  - returns `{ results }` where each entry is either:
    - success: `{ success: true, filename, id, event, activities }`
    - failure: `{ success: false, filename, error }`
- `PATCH /api/events/:id`
  - updates event folder assignment via `{ folderId }`
- `PATCH /api/events/:id/activities/:activityId`
  - updates activity fields via `{ type?, deviceName? }`
- `GET /api/events/:id/activities/:activityId/streams`
  - optional query `types`
  - returns `[{ type, data: [{ time, value }] }]`
- `DELETE /api/events/:id`

### Folders

- `GET /api/folders`
- `POST /api/folders`
- `GET /api/folders/:id`
- `PATCH /api/folders/:id`
- `DELETE /api/folders/:id?contents=unfile|delete`

Folder semantics:

- folder selection uses `all`, `unfiled`, or a folder UUID
- deleting with `contents=unfile` keeps items and clears `folder_id`
- deleting with `contents=delete` removes folder contents

### Comparisons

- `POST /api/comparisons`
  - body: `{ name, activityIds, settings?, folderId? }`
- `GET /api/comparisons?folderId=...`
- `POST /api/comparisons/by-events`
  - body: `{ eventIds }`
- `GET /api/comparisons/:id`
- `DELETE /api/comparisons/:id`

Comparison responses include:

- `id`, `name`
- `eventIds`
- `activityIds`
- optional `settings`
- optional `folderId`
- optional `mixed`
- optional `surfaced`
- optional `createdAt`

### Meta

- `GET /api/activity-types`
- `GET /api/devices`

These derive distinct values from the authenticated user's data.

## Frontend contract

The frontend consumes API JSON directly.

Important modules:

- `frontend/src/lib/api/client.ts`: authenticated fetch wrapper with CSRF handling
- `frontend/src/lib/api/events.ts`: event, activity, stream, and upload API calls
- `frontend/src/lib/api/comparisons.ts`: comparison CRUD and candidate lookup
- `frontend/src/lib/api/folders.ts`: folder CRUD
- `frontend/src/lib/api/account.ts`: export and account deletion
- `frontend/src/lib/api/auth.ts`: auth check and logout
- `frontend/src/lib/stores/auth.svelte.ts`: auth state, CSRF token, login state
- `frontend/src/lib/stores/folders.svelte.ts`: folder list and selection state
- `frontend/src/lib/types/event.ts`: canonical frontend shapes for events, activities, streams, folders, and comparisons

Primary route usage:

- `dashboard.svelte`: activity rows, uploads, filters, delete flows, folder views
- `event-detail.svelte`: event detail, stream loading, activity edits
- `comparisons.svelte`: comparison list and delete flow
- `comparison-view.svelte`: comparison creation/view flows
- `account.svelte`: export and account deletion

## Security and ownership invariants

- Sessions use `express-session` with a Valkey-backed `connect-redis` store.
- Session cookie name is `ofl.sid`.
- Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- CSRF protection is session-based and applied before protected state-changing requests.
- Repositories and services enforce ownership with `user_id` / `req.userId`.
- Parameterized SQL is used through repository helpers.
- Auth, callback, upload, and general API routes are rate-limited.

## Architectural decisions

- **Backend parsing:** files are parsed on the server with `@sports-alliance/sports-lib`.
- **No original file storage:** uploaded files are discarded after parsing.
- **Relational stats:** event/activity stats are normalized into separate tables.
- **Relational stream points:** stream data is stored row-by-row for ordering and time filtering.
- **Server-managed auth:** OAuth plus server sessions, not client-managed tokens.
- **Schema-on-startup:** simple self-hosted setup over migrations.

## Source references

- App bootstrap: `backend/src/index.js`
- Config: `backend/src/config.js`
- Schema: `backend/sql/schema.sql`
- Auth routes: `backend/src/routes/auth.js`
- Event routes: `backend/src/routes/events.js`
- Comparison routes: `backend/src/routes/comparisons.js`
- Folder routes: `backend/src/routes/folders.js`
- Meta routes: `backend/src/routes/meta.js`
- Response shaping: `backend/src/utils/transforms.js`
- Input validation: `backend/src/utils/validation.js`
- Error classes: `backend/src/errors.js`
- Frontend types: `frontend/src/lib/types/event.ts`
