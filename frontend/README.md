# OpenFitLab Frontend

Svelte 5, Vite, Tailwind CSS v4, svelte-spa-router. The app calls `/api` (proxied in dev, same-origin in production).

**Data flow:** Workouts use `/api/events/activity-rows`; event detail uses `/api/events/:id` and stream endpoints; comparisons use the comparisons API. Strava list/import when `GET /api/auth/me` reports `integrations.providers.strava.configured`. Details: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

**Frontend architecture (SPA):**

* **`lib/api/client.ts` (`apiFetch`)** — All JSON calls go through this wrapper (credentials, CSRF on mutations, 401/403 handling). **Concurrent GET requests to the same URL share one network call**; each caller receives a **cloned** `Response` so body consumers stay independent (in environments without `Response.prototype.clone`, the shared response is returned as-is). GETs with `signal` / `AbortController`, non-GET methods, or request bodies are not coalesced.
* **Route-level data** — Heavy list/detail loading lives in **stores** (e.g. `lib/stores/workouts-controller.svelte.ts`, `lib/stores/event-detail-loader.svelte.ts`) so routes stay thin; folder hash and auth remain in their existing stores.
* **Shell** — `App.svelte` composes `FolderSidebar` + `Router`; authenticated routes use a shared max-width content column with horizontal padding on small viewports.

**Theme ("Graphite"):** All colours and fonts are tokens in the `@theme` block of `src/app.css`. Surfaces are flat zinc greys stepped by lightness (`bg` → `surface` → `card` → `card-hover`, with `border`); there are no gradients or translucent glass panels. Colour is reserved for data and icons: use the `data-*` tokens (`text-data-green`, …) via `getActivityIconColor` / `getStatIconColor`, and keep the single blue accent for primary buttons and selected state (`accent` as a fill, `accent-text` as text on dark panels). Numbers in tables and stat tiles use `font-mono tabular-nums`. IBM Plex Sans/Mono load from Google Fonts in `index.html`, the same way as Material Icons.

**Commands, quality gate, and conventions:** [AGENTS.md](../AGENTS.md) (`npm run ci`).

**Google Analytics (optional):** Set `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` at build time to enable GA4 tracking. Omit the variable (or leave it blank) to disable analytics entirely — no script is injected and no data is sent.

To get a Measurement ID:
1. Go to [analytics.google.com](https://analytics.google.com) and sign in.
2. Create a new **GA4 property** (Admin → Create → Property). Choose *Web* as the platform.
3. When prompted, enter your site URL and stream name to create a **Web data stream**.
4. Copy the **Measurement ID** (format `G-XXXXXXXXXX`) from the stream details page.
5. Set `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` in your `.env` (or pass it as a build-time env var).

The app respects the browser's Do Not Track signal and a per-user opt-out stored in `localStorage`. Page views are tracked automatically on every SPA route change. No advertising features or Google Signals are enabled.

**Deferred upgrade: TypeScript 7.** `npm outdated` lists `typescript` 6.0.3 to 7.0.2 and `package.json` pins `~6.0.3`. Keep it there. TypeScript 7.0 (the native compiler, released 8 July 2026) exposes no programmatic compiler API until 7.1, and two tools in `npm run ci` need one: `svelte-check` declares `typescript: "^5.0.0 || ^6.0.0"` and its check step fails with `ERR_PACKAGE_PATH_NOT_EXPORTED` for `typescript/package.json`, while `typescript-eslint` declares `typescript: ">=4.8.4 <6.1.0"` and its parse step throws inside `@typescript-eslint/typescript-estree`. `npm install` after a bump fails with ERESOLVE, so do not reach for `--force` or `--legacy-peer-deps`.

The project is already TS 7 ready: `baseUrl` and `paths` were removed (commit `4661259`), both tsconfigs set explicit `types` arrays, and the code uses `moduleResolution: bundler`, `module: ESNext`, ES2022/ES2023 targets, `noEmit`, and no `.js` sources. The wait is on tooling, not on us. Re-check [language-tools#3063](https://github.com/sveltejs/language-tools/issues/3063) and [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940) before retrying. If a trial is wanted sooner, a reversible one exists: add `"typescript": "npm:@typescript/typescript6@^6.0.2"` and `"@typescript/native": "npm:typescript@^7.0.2"` so the TS 6 API keeps `svelte-check` and `typescript-eslint` working while `tsc` runs 7.0.2, then roll back with `git checkout -- frontend/package.json frontend/package-lock.json` followed by `npm ci`. Installs need Node >= 22.22.2 because `frontend/.npmrc` sets `engine-strict=true`.

