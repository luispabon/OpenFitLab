# OpenFitLab Frontend

Svelte 5, Vite, Tailwind CSS v4, svelte-spa-router. The app calls `/api` (proxied in dev, same-origin in production).

**Data flow:** Workouts use `/api/events/activity-rows`; event detail uses `/api/events/:id` and stream endpoints; comparisons use the comparisons API. Strava list/import when `GET /api/auth/me` reports `integrations.providers.strava.configured`. Details: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

**Commands and quality gate:** [AGENTS.md](../AGENTS.md) (`npm run ci`). Conventions: [.cursor/rules/frontend-lint-test.mdc](../.cursor/rules/frontend-lint-test.mdc), [.cursor/rules/svelte-frontend.mdc](../.cursor/rules/svelte-frontend.mdc).

**Google Analytics (optional):** Set `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` at build time to enable GA4 tracking. Omit the variable (or leave it blank) to disable analytics entirely — no script is injected and no data is sent.

To get a Measurement ID:
1. Go to [analytics.google.com](https://analytics.google.com) and sign in.
2. Create a new **GA4 property** (Admin → Create → Property). Choose *Web* as the platform.
3. When prompted, enter your site URL and stream name to create a **Web data stream**.
4. Copy the **Measurement ID** (format `G-XXXXXXXXXX`) from the stream details page.
5. Set `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in your `.env` (or pass it as a build-time env var).

The app respects the browser's Do Not Track signal and a per-user opt-out stored in `localStorage`. Page views are tracked automatically on every SPA route change. No advertising features or Google Signals are enabled.

