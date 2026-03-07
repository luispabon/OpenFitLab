# OpenFitLab Frontend

Svelte 5, Vite, Tailwind CSS v4, svelte-spa-router. Run: `npm run dev`. Build: `npm run build`; preview: `npm run preview`. The app uses `/api` for the backend (proxied in dev, same-origin in production).

**How it works:** Workouts lists activities via GET /api/events/activity-rows (filters, pagination). Event detail loads the event (GET /api/events/:id) then streams for the selected activity (GET .../streams). Comparisons list and comparison view use the comparisons API; see [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for route → API usage.

**Quality gate and testing:** Run `npm run format`, `npm run lint`, `npm run check`, `npm run test`, and `npm run build` from `frontend/`. Single command for all checks: `npm run ci`. Tests use Vitest; unit and API tests live in `__tests__/` next to modules, fixtures in `src/test/fixtures/`. See [.cursor/rules/frontend-lint-test.mdc](../.cursor/rules/frontend-lint-test.mdc) for conventions.

See root [AGENTS.md](../AGENTS.md) for stack and [.cursor/rules/svelte-frontend.mdc](../.cursor/rules/svelte-frontend.mdc) for conventions.
