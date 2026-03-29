### OAuth Provider Setup

At least one OAuth provider must be configured for login to work. All are optional — only the providers with credentials present in `.env` will appear on the login page.

#### Google

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Create a project (or select an existing one).
3. Click **Create Credentials** → **OAuth client ID**.
4. Select **Web application** as the application type.
5. Under **Authorized redirect URIs**, add:
   - Local development: `http://localhost:3000/api/auth/google/callback`
   - Production: `https://<your-domain>/api/auth/google/callback`
6. Copy the **Client ID** and **Client Secret** into `.env`:

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

> [!TIP]
> You may need to configure the **OAuth consent screen** first (user type, app name, scopes). The only scope required is `email` + `profile` (selected automatically by the app).

#### GitHub

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) → **OAuth Apps** → **New OAuth App**.
2. Fill in the form:
   - **Application name**: anything (e.g. `OpenFitLab`)
   - **Homepage URL**: `http://localhost:4200` (or your production URL)
   - **Authorization callback URL**:
     - Local development: `http://localhost:3000/api/auth/github/callback`
     - Production: `https://<your-domain>/api/auth/github/callback`
3. Click **Register application**.
4. On the app page, copy the **Client ID**. Click **Generate a new client secret** and copy it.
5. Add both to `.env`:

```env
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
```

#### Apple

1. Go to [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles**.
2. Create an **App ID** with the **Sign In with Apple** capability (or use an existing one).
3. Under **Identifiers**, create a **Services ID** — this becomes `APPLE_CLIENT_ID` (e.g. `com.example.openfitlab`).
   - Enable **Sign In with Apple**, click **Configure**, add your domain and return URL:
     - Production: `https://<your-domain>/api/auth/apple/callback`
4. Under **Keys**, create a new key with **Sign In with Apple** enabled. Download the `.p8` file (only downloadable once).
5. Note your **Team ID** (top-right of the developer portal) and **Key ID** (shown on the key detail page).
6. Add to `.env`, pasting the `.p8` contents as a single line with literal `\n` for newlines:

```env
APPLE_CLIENT_ID=com.example.openfitlab
APPLE_TEAM_ID=XXXXXXXXXX
APPLE_KEY_ID=XXXXXXXXXX
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----
```

> [!IMPORTANT]
> Apple requires an **HTTPS** callback URL — `http://localhost` is not supported. For local development, use a tunnel such as [ngrok](https://ngrok.com) and set `OAUTH_CALLBACK_URL` to the tunnel's HTTPS URL.

> [!NOTE]
> Apple only provides the user's email address on the **first** login. Subsequent logins with the same Apple ID will not include an email.

#### Facebook

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**.
2. Select **Consumer** as the app type and give it a name.
3. Go to **App Settings → Basic** and copy the **App ID** and **App Secret**.
4. Add the **Facebook Login** product → go to its **Settings** → add Valid OAuth Redirect URIs:
   - Local development: `http://localhost:3000/api/auth/facebook/callback`
   - Production: `https://<your-domain>/api/auth/facebook/callback`
5. Add to `.env`:

```env
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-app-secret
```

> [!NOTE]
> While the app is in **Development** mode, only users with admin, developer, or tester roles on the Facebook app can log in. Switch the app to **Live** mode for public access — this requires completing Facebook's app review for the `email` permission.

#### Callback Base URL

Set `OAUTH_CALLBACK_URL` to the public base URL of your app (no trailing slash). This is used to construct the callback URLs above:

```env
# Local development (default)
OAUTH_CALLBACK_URL=http://localhost:3000

# Production example
OAUTH_CALLBACK_URL=https://fit.example.com
```

### Strava activity import (optional)

OpenFitLab can import activities from **Strava** when you register an API application and add credentials to `.env`. This is separate from login OAuth (Google, GitHub, etc.): users connect Strava from **Workouts → Import from…** after signing in normally.

**On the Strava website**

1. Sign in at [strava.com](https://www.strava.com), then open **[Settings → My API Application](https://www.strava.com/settings/api)** (or go directly to that URL).
2. Click **Create an App** (or **Edit** an existing app).
3. Fill in:
   - **Application Name** — any label (e.g. `OpenFitLab (self-hosted)`).
   - **Website** — optional; often your app’s public URL (e.g. `http://localhost:4200` for local dev, or your production site).
   - **Application Description** — optional short text.
   - **Authorization Callback Domain** — must match the **host** of your API’s public base URL (`OAUTH_CALLBACK_URL`), without `http://`/`https://` and without a path:
     - Local API on port 3000: use **`localhost`** (Strava allows `localhost` for development; any port on localhost is fine for the redirect URI).
     - Production: use your API hostname only, e.g. **`openfitlab.org`** if the API is served at `https://openfitlab.org`.
4. Save the app. On the same page, copy the **Client ID** and **Client Secret** (click to reveal the secret).

**Redirect URI you must use**

The OAuth redirect path is fixed by OpenFitLab. It must be exactly:

`{OAUTH_CALLBACK_URL}/api/integrations/strava/callback`

Examples:

- Local: `http://localhost:3000/api/integrations/strava/callback`
- Production: `https://your-api-host/api/integrations/strava/callback`

Strava validates the `redirect_uri` against your **Authorization Callback Domain**; keep `OAUTH_CALLBACK_URL` in `.env` consistent with the domain you registered.

**In `.env`**

Set both values (import is disabled if either is empty):

```env
OAUTH_CALLBACK_URL=http://localhost:3000
STRAVA_CLIENT_ID=your-client-id
STRAVA_CLIENT_SECRET=your-client-secret
```

After restarting the API, `GET /api/auth/me` reports `integrations.providers.strava.configured: true` and the Workouts page shows **Import from…**. Strava access tokens are stored in the session (Valkey), not in the database. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (Strava import) for behavior details.
