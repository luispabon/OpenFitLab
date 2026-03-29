# Product Requirements Document (PRD)
## OpenFitLab - Fitness Activity Tracker

**Role:** Canonical product requirements and planned scope. This document defines vision, user stories, features, constraints, and glossary. Technical implementation lives in [docs/ARCHITECTURE.md](ARCHITECTURE.md). Agent quickstart lives in [AGENTS.md](../AGENTS.md).

### Version: 1.1
### Date: 2026-03-28

---

## 1. Product overview

### 1.1 Vision

OpenFitLab is a self-hosted fitness activity tracking and comparison platform for people who want to analyze workouts, compare activities, and evaluate different fitness trackers while keeping control of their data.

### 1.2 Mission

Provide a privacy-focused, self-hosted way to bring in activity data (file upload and, where configured, third-party import), then visualize, organize, and compare it across multiple devices and sources.

### 1.3 Target users

- **Primary:** Fitness enthusiasts using one or more trackers
- **Secondary:** Athletes and coaches reviewing performance data
- **Tertiary:** Privacy-conscious users who prefer self-hosting

### 1.4 Core value propositions

- **Privacy:** user-controlled, self-hosted data
- **Comparison:** side-by-side workout comparison
- **Tracker evaluation:** compare the same workout across devices
- **Flexibility:** support multiple import formats
- **Visualization:** interactive charts for workout metrics

---

## 2. User stories

### 2.1 Core user stories

**US-1: Upload activity files**

- **As a** fitness enthusiast
- **I want to** upload activity files from my tracker
- **So that** I can store and analyze workout data

**US-2: View activity data**

- **As a** user
- **I want to** browse my uploaded activities
- **So that** I can review workouts at a glance

**US-3: Visualize workout metrics**

- **As a** user
- **I want to** view graphs for heart rate, cadence, pace, elevation, and similar metrics
- **So that** I can understand workout performance over time

**US-4: Compare activities**

- **As a** user
- **I want to** compare two or more workouts side-by-side
- **So that** I can see performance differences over time

**US-5: Analyze stream correlations**

- **As a** user
- **I want to** analyze relationships between streams such as heart rate and pace
- **So that** I can better understand performance patterns

**US-6: Compare fitness trackers**

- **As a** user
- **I want to** compare the same workout across multiple trackers
- **So that** I can evaluate device accuracy and consistency

**US-7: Import from a connected platform**

- **As a** user
- **I want to** import activities from a supported service (e.g. Strava) when my operator has configured it
- **So that** I can load workouts without exporting files manually

---

## 3. Features

### 3.1 File upload

**Status:** Implemented

Users can upload supported activity files and receive clear success or failure feedback.

Requirements:

- accept one or more activity files
- support TCX, FIT, GPX, JSON, and SML
- extract event, activity, statistics, and stream data
- persist imported data for later analysis

### 3.2 Activity dashboard

**Status:** Implemented

Users can browse uploaded workouts in a reverse-chronological dashboard.

Requirements:

- show uploaded workouts clearly
- support filtering and pagination
- link to a detailed event view

### 3.3 Activity visualization

**Status:** Implemented

Users can inspect workout streams in interactive charts.

Requirements:

- support common stream types such as heart rate, cadence, pace, elevation, speed, and power
- show time-series views
- provide interactive inspection such as hover detail and zoom
- allow overlay of multiple metrics where useful

### 3.4 Activity comparison

**Status:** Implemented

Users can compare multiple workouts side-by-side.

Requirements:

- select multiple activities or events for comparison
- align views in a shared comparison workflow
- show chart overlays and statistics deltas

### 3.5 Stream analysis

**Status:** Implemented

Users can analyze relationships between streams across compared activities.

Implemented capabilities:

- nearest-neighbour time alignment of streams across two recordings (30-second tolerance)
- XY scatter plot with OLS regression line overlay
- delta-over-time chart (secondary − reference)
- summary statistics: Pearson r, R², slope, intercept, mean difference, max absolute difference, and point count
- reference device picker: choose which activity acts as the baseline for deltas and scatter plots
- stream type selector showing only streams common to all compared activities
- `referenceActivityId` persisted in comparison settings

### 3.6 Tracker comparison

**Status:** Implemented via activity comparison

Users can compare data from different trackers for the same workout by importing multiple recordings and viewing them through the comparison flow.

### 3.6.1 Comparison image export

**Status:** Implemented

Users can export sections of the comparison view as PNG files directly from the browser.

Requirements:

- export the stats table (hidden stat rows are excluded)
- export the route map at full resolution
- export each individual stream comparison chart
- export each stream analysis card (scatter chart, delta chart, and stats row)
- exported images use the app's dark colour scheme with an opaque background
- export controls are themselves excluded from the captured image

### 3.7 Folder organization

**Status:** Implemented

Users can organize events and comparisons into named, colored folders with optional pinning.

Requirements:

- create, rename, recolor, and delete folders
- assign events and comparisons to folders
- filter dashboard and comparison views by folder
- pinned folders appear first in navigation

### 3.8 Site activity reporting

**Status:** Planned

Some form of reporting on site activity (e.g. number of users, events, activities, and trends over time) may be added later. Possible directions include an admin or privileged user who can see these aggregates and richer analytics (e.g. events and activities created over time), or metrics export / a Grafana (or similar) dashboard for self-hosting operators to monitor usage without an in-app admin UI. Design and delivery mechanism are not yet decided.

### 3.9 Activity file export

**Status:** Implemented

Users can download activity data reconstructed from stored event, activity, stats, and stream data. The original uploaded file is discarded after processing and is not available for download; exports are a best-effort reconstruction from what was stored.

Requirements:

- TCX available for every event; GPX only when GPS streams exist
- UI explains that exports are reconstructed from stored data (notice always visible near export controls, not a modal blocker)
- export controls on event detail: dropdown (top-right, same level as back navigation) with TCX always and GPX when applicable
- FIT export out of scope until a suitable maintained writer exists

API and file format behaviour: [docs/ARCHITECTURE.md](ARCHITECTURE.md) (File export).

### 3.10 Third-party platform import

**Status:** Implemented (Strava v1)

Users can pull activities from supported fitness platforms so they do not have to export files manually. **v1 is Strava** (OAuth, Workouts **Import from…**, deduplication, same relational model as uploads, **View on Strava** on event detail). Other providers are candidates for later releases.

**Requirements**

- Same data model as file uploads (events, activities, stats, streams).
- Operator-configured credentials; if not configured, no import entry point.
- User connects, browses, and chooses imports; no automatic background sync.
- No duplicate imports for the same provider activity; deleting the local event allows re-import.
- Strava branding and API terms must be respected.

Operator setup and technical behaviour: [docs/INTEGRATIONS_INSTRUCTIONS.md](INTEGRATIONS_INSTRUCTIONS.md) and [docs/ARCHITECTURE.md](ARCHITECTURE.md) (Strava import).

### 3.11 Single-user passphrase mode

**Status:** Planned

For personal deployments where configuring an OAuth2 provider is impractical, a single-user mode may be offered. The operator would set a passphrase via an environment variable and use it to log in directly, with no external identity provider required. This follows a pattern common in self-hosted tools (e.g. Miniflux, Stirling-PDF) and removes the main barrier to entry for simple homelab setups.

---

## 4. Product constraints

- The product is self-hosted.
- Authentication is required for personal data access.
- Users manage their own data and should be able to export or delete it.
- The product supports activity files from external devices and **user-initiated** import from configured third-party APIs; it does **not** perform live or background device sync.
- Privacy and data ownership take priority over social or cloud-platform features.

---

## 5. User experience

### 5.1 Core flow

1. User starts the application.
2. User signs in.
3. User lands on the dashboard.
4. User adds workouts by **uploading activity files** and/or, when the operator has configured integrations, **importing from a supported third-party platform** (e.g. Strava).
5. User reviews event detail and charts.
6. User compares workouts when needed.

### 5.2 Key screens

- Login
- Dashboard
- Event detail
- Comparison list and comparison view
- Third-party import modal (from Workouts, when configured)
- Account/privacy controls

### 5.3 Design principles

- keep the interface simple
- keep data and charts central
- work well on desktop and tablet
- continue improving accessibility over time

---

## 6. Success metrics

### 6.1 Current success criteria

- users can upload activity files successfully
- users can review workouts in a dashboard
- users can inspect workout metrics visually
- users can compare activities side-by-side
- users can analyze stream correlations (comparison view stream analysis)
- users can compare trackers effectively (via multi-device imports and comparison)
- when the operator configures Strava, users can import activities from Strava without duplicate events for the same source activity (until they delete the local event)

### 6.2 Future success criteria

- the product remains usable with large personal histories

---

## 7. Roadmap

### Phase 1

- file upload
- dashboard
- event detail and visualization

### Phase 2

- activity comparison
- richer chart interactions

### Phase 3

- stream analysis
- scatter plots and correlation views
- comparison image export (stats, map, charts, stream analysis cards)

### Phase 4

- third-party platform import (v1: Strava: OAuth, modal picker, deduplication, same data model as file upload)
- additional import sources and UX refinements over time
- continued UX and accessibility improvements

### Phase 5

- integration and end-to-end testing

**Backend integration tests** (real MariaDB via `testcontainers-node`, separate CI job): transaction correctness; cascade deletes; schema constraints; OAuth pending-signup → complete-signup flow.

**End-to-end tests** (Playwright, Docker Compose): **Implemented** — `e2e/tests/`, on every PR to `main` (`.github/workflows/e2e-checks.yml`). Covers upload → dashboard → event detail → comparison; folders; account export/delete; CSRF and auth; deletes. Dedicated stack: API `3098`, DB `3308`, Frontend `4201`.

### Phase 6 (future)

- site activity reporting and optional admin or metrics dashboard

---

## 8. Constraints and assumptions

### 8.1 Constraints

- self-hosted deployment
- authenticated multi-user access
- support limited to known file import formats and **configured** third-party APIs (no arbitrary external services)

### 8.2 Assumptions

- users are comfortable running a self-hosted app
- users have access to exported tracker files and/or accounts on supported third-party platforms (when the operator enables those integrations)
- users care about privacy and ownership of their workout data

### 8.3 Out of scope

- mobile app
- real-time tracker sync
- social features
- advanced ML-based analytics

---

## 9. Risks

- large files or long histories may affect performance
- inconsistent source files may produce parsing edge cases
- advanced analysis features may add UI complexity if not designed carefully
- third-party APIs (rate limits, policy changes, or downtime) may affect import availability or require reconnecting the integration

---

## 10. Glossary

- **Event:** top-level workout session created from a file upload or a third-party import
- **Activity:** individual sport segment within an event
- **Stream:** time-series metric such as heart rate, pace, or cadence
- **Data Point:** one timestamped value inside a stream
- **Stat:** aggregated metric derived from an event or activity
- **Folder:** named, colored grouping for events and comparisons
- **Comparison:** saved side-by-side selection of activities across events

Technical implementation details for these concepts are documented in [docs/ARCHITECTURE.md](ARCHITECTURE.md).
