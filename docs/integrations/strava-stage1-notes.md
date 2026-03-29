# Strava integration — Stage 1 verification notes

Operator checklist before production (see also [Strava API Agreement](https://www.strava.com/legal/api) and [brand guidelines](https://developers.strava.com/guidelines/)). **Redirect URI:** register the exact URI from [docs/INTEGRATIONS_INSTRUCTIONS.md](../INTEGRATIONS_INSTRUCTIONS.md) (Strava activity import).

- [ ] Register that redirect URI in the Strava app (exact match, including scheme and path).
- [ ] Decide one Strava app for dev+prod (same callback host) vs separate apps per environment; document in operator runbook.
- [ ] OAuth authorize with `scope=activity:read_all`; confirm `GET /athlete/activities`, `GET /activities/{id}`, and `GET /activities/{id}/streams` succeed on at least one private activity.
- [ ] If any required call returns 403, widen scope in the app settings and update the authorize URL in code.

## HTTP / batching strategy (Stage 5+)

Strava does **not** expose a single request to fetch multiple activities by ID. Use **per-ID** calls with **bounded concurrency** (e.g. 5 parallel) for detail + streams. Respect rate limits: **600 requests / 15 minutes** and **30,000 / day** per app; on **429**, honor `Retry-After` when present and surface a single user-facing message.

## Stream type mapping (Strava → OpenFitLab)

| Strava stream key | Canonical stream type / notes |
|-------------------|-------------------------------|
| `time` | `Time` (offsets in seconds → absolute ms in extractor) |
| `distance` | `Distance` |
| `latlng` | `Position` (each sample `{ lat, lng }` from Strava `[lat, lng]` pairs) |
| `altitude` | `Altitude` |
| `heartrate` | `Heart Rate` |
| `cadence` | `Cadence` |
| `watts` | `Power` |
| `temp` | `Temperature` |
| `velocity_smooth` | `Speed` (when present) |

Types with no OpenFitLab equivalent are skipped. Unknown Strava activity types map to activity type **Other**.
