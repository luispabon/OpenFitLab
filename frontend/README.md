# OpenFitLab Frontend

Svelte 5, Vite, Tailwind CSS v4, svelte-spa-router. Run: `npm run dev`. Build: `npm run build`; preview: `npm run preview`. The app uses `/api` for the backend (proxied in dev, same-origin in production).

**How it works:** Workouts lists activities via GET /api/events/activity-rows (filters, pagination). Event detail loads the event (GET /api/events/:id) then streams for the selected activity (GET .../streams). Comparisons list and comparison view use the comparisons API; see [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for route → API usage.

**Quality gate and testing:** Run `npm run format`, `npm run lint`, `npm run check`, `npm run test`, and `npm run build` from `frontend/`. Single command for all checks: `npm run ci`. Tests use Vitest; unit and API tests live in `__tests__/` next to modules, fixtures in `src/test/fixtures/`. See [.cursor/rules/frontend-lint-test.mdc](../.cursor/rules/frontend-lint-test.mdc) for conventions.

**Google Analytics (optional):** Set `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` at build time to enable GA4 tracking. Omit the variable (or leave it blank) to disable analytics entirely — no script is injected and no data is sent.

To get a Measurement ID:
1. Go to [analytics.google.com](https://analytics.google.com) and sign in.
2. Create a new **GA4 property** (Admin → Create → Property). Choose *Web* as the platform.
3. When prompted, enter your site URL and stream name to create a **Web data stream**.
4. Copy the **Measurement ID** (format `G-XXXXXXXXXX`) from the stream details page.
5. Set `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in your `.env` (or pass it as a build-time env var).

The app respects the browser's Do Not Track signal and a per-user opt-out stored in `localStorage`. Page views are tracked automatically on every SPA route change. No advertising features or Google Signals are enabled.

See root [AGENTS.md](../AGENTS.md) for stack and [.cursor/rules/svelte-frontend.mdc](../.cursor/rules/svelte-frontend.mdc) for conventions.
