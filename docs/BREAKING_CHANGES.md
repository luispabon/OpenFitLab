# Breaking Changes

## Authentication & Multi-User Support (Stage 0+)

**This version requires a fresh database.** Existing databases are not compatible.

### What changed

- Added `users`, `user_identities`, and `sessions` tables.
- Added `user_id` column to `events` and `comparisons` tables.
- All data is now scoped to authenticated users.

### Why a migration isn't provided

- The app uses `CREATE TABLE IF NOT EXISTS` on startup (no migration framework).
- This is a fundamental architectural change — there are no existing users to assign data to.
- Self-hosted users' original activity files (FIT, TCX, GPX, etc.) are the source of truth, not the database.

### How to upgrade

1. **Back up any important data** (export activity files if needed).
2. Tear down the existing database:
   ```bash
   docker compose down -v
   ```
3. Start fresh:
   ```bash
   docker compose up -d
   ```
4. Re-upload your activity files after logging in with an OAuth provider.

### New required environment variables

See `.env.example` for the full list. At minimum you need:

- `SESSION_SECRET` — generate with `openssl rand -hex 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — from GitHub Developer Settings
- `OAUTH_CALLBACK_URL` — your app's public base URL
