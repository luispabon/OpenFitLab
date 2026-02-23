# OpenFitLab Frontend

Svelte 5, Vite, Tailwind CSS v4, svelte-spa-router. Run: `npm run dev`. Build: `npm run build`; preview: `npm run preview`. The app uses `/api` for the backend (proxied in dev, same-origin in production).

**How it works:** Dashboard lists activities via GET /api/events/activity-rows (filters, pagination). Event detail loads the event (GET /api/events/:id) then streams for the selected activity (GET .../streams). Comparisons list and comparison view use the comparisons API; see [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for route → API usage.

See root [AGENTS.md](../AGENTS.md) for stack and [.cursor/rules/svelte-frontend.mdc](../.cursor/rules/svelte-frontend.mdc) for conventions.
