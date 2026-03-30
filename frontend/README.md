# OpenFitLab Frontend

Svelte 5, Vite, Tailwind CSS v4, svelte-spa-router. The app calls `/api` (proxied in dev, same-origin in production).

**Data flow:** Workouts use `/api/events/activity-rows`; event detail uses `/api/events/:id` and stream endpoints; comparisons use the comparisons API. Strava list/import when `GET /api/auth/me` reports `integrations.providers.strava.configured`. Details: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

**Frontend architecture (SPA):**

* **`lib/api/client.ts` (`apiFetch`)** — All JSON calls go through this wrapper (credentials, CSRF on mutations, 401/403 handling). **Concurrent GET requests to the same URL share one network call**; each caller receives a **cloned** `Response` so body consumers stay independent (in environments without `Response.prototype.clone`, the shared response is returned as-is). GETs with `signal` / `AbortController`, non-GET methods, or request bodies are not coalesced.
* **Route-level data** — Heavy list/detail loading lives in **stores** (e.g. `lib/stores/workouts-controller.svelte.ts`, `lib/stores/event-detail-loader.svelte.ts`) so routes stay thin; folder hash and auth remain in their existing stores.
* **Shell** — `App.svelte` composes `FolderSidebar` + `Router`; authenticated routes use a shared max-width content column with horizontal padding on small viewports.

**Commands and quality gate:** [AGENTS.md](../AGENTS.md) (`npm run ci`). Conventions: [.cursor/rules/frontend-lint-test.mdc](../.cursor/rules/frontend-lint-test.mdc), [.cursor/rules/svelte-frontend.mdc](../.cursor/rules/svelte-frontend.mdc).

**Google Analytics (optional):** Set `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` at build time to enable GA4 tracking. Omit the variable (or leave it blank) to disable analytics entirely — no script is injected and no data is sent.

To get a Measurement ID:
1. Go to [analytics.google.com](https://analytics.google.com) and sign in.
2. Create a new **GA4 property** (Admin → Create → Property). Choose *Web* as the platform.
3. When prompted, enter your site URL and stream name to create a **Web data stream**.
4. Copy the **Measurement ID** (format `G-XXXXXXXXXX`) from the stream details page.
5. Set `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in your `.env` (or pass it as a build-time env var).

The app respects the browser's Do Not Track signal and a per-user opt-out stored in `localStorage`. Page views are tracked automatically on every SPA route change. No advertising features or Google Signals are enabled.

