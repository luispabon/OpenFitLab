/**
 * Backend configuration. This is the ONLY place in the backend that reads process.env.
 * All other modules must obtain configuration by requiring this module.
 */

const path = require('path');

const {
  PORT,
  UPLOAD_DIR,
  NODE_ENV,
  ALLOWED_ORIGINS,
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_DATABASE,
  SESSION_SECRET,
  OAUTH_CALLBACK_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  API_RATE_LIMIT_MAX,
  API_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_CALLBACK_RATE_LIMIT_MAX,
  AUTH_CALLBACK_RATE_LIMIT_WINDOW_MS,
  UPLOAD_RATE_LIMIT_MAX,
  UPLOAD_RATE_LIMIT_WINDOW_MS,
} = process.env;

function parseRateLimit(maxRaw, windowRaw, defaultMax, defaultWindowMs) {
  const max = maxRaw != null && maxRaw !== '' ? parseInt(String(maxRaw), 10) : defaultMax;
  const windowMs =
    windowRaw != null && windowRaw !== '' ? parseInt(String(windowRaw), 10) : defaultWindowMs;
  const valueMax = Number.isNaN(max) ? defaultMax : Math.max(1, max);
  const valueWindow =
    Number.isNaN(windowMs) || windowMs < 1000 ? defaultWindowMs : Math.max(1000, windowMs);
  return { max: valueMax, windowMs: valueWindow };
}

const isProduction = NODE_ENV === 'production';

const port =
  PORT != null && PORT !== ''
    ? (() => {
        const n = parseInt(String(PORT), 10);
        return Number.isNaN(n) ? 3000 : Math.max(1, Math.min(65535, n));
      })()
    : 3000;

const uploadDir =
  UPLOAD_DIR && String(UPLOAD_DIR).trim().length > 0
    ? String(UPLOAD_DIR).trim()
    : path.join(__dirname, '..', 'uploads');

const corsAllowedOrigins = isProduction
  ? ALLOWED_ORIGINS
    ? String(ALLOWED_ORIGINS)
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : false
  : true;

const oauthRedirectBase = isProduction ? '' : 'http://localhost:4200';

const db = {
  host: DB_HOST || 'localhost',
  user: DB_USER || 'qs',
  password: DB_PASSWORD || 'qspass',
  database: DB_DATABASE || 'openfitlab',
};

const sessionSecret = SESSION_SECRET != null ? String(SESSION_SECRET) : '';
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be set and at least 32 characters');
}

const session = {
  secret: sessionSecret,
  cookieSecure: isProduction,
};

const oauthCallbackUrl = OAUTH_CALLBACK_URL || 'http://localhost:3000';

const googleClientId = GOOGLE_CLIENT_ID != null ? String(GOOGLE_CLIENT_ID) : '';
const googleClientSecret = GOOGLE_CLIENT_SECRET != null ? String(GOOGLE_CLIENT_SECRET) : '';
const githubClientId = GITHUB_CLIENT_ID != null ? String(GITHUB_CLIENT_ID) : '';
const githubClientSecret = GITHUB_CLIENT_SECRET != null ? String(GITHUB_CLIENT_SECRET) : '';

const oauth = {
  callbackUrl: oauthCallbackUrl,
  google: {
    enabled: !!(googleClientId && googleClientSecret),
    clientId: googleClientId || undefined,
    clientSecret: googleClientSecret || undefined,
  },
  github: {
    enabled: !!(githubClientId && githubClientSecret),
    clientId: githubClientId || undefined,
    clientSecret: githubClientSecret || undefined,
  },
};

const rateLimit = {
  api: parseRateLimit(API_RATE_LIMIT_MAX, API_RATE_LIMIT_WINDOW_MS, 100, 60_000),
  auth: parseRateLimit(AUTH_RATE_LIMIT_MAX, AUTH_RATE_LIMIT_WINDOW_MS, 10, 15 * 60_000),
  authCallback: parseRateLimit(
    AUTH_CALLBACK_RATE_LIMIT_MAX,
    AUTH_CALLBACK_RATE_LIMIT_WINDOW_MS,
    20,
    15 * 60_000
  ),
  upload: parseRateLimit(UPLOAD_RATE_LIMIT_MAX, UPLOAD_RATE_LIMIT_WINDOW_MS, 30, 15 * 60_000),
};

const config = {
  db,
  server: {
    port,
    uploadDir,
    isProduction,
    corsAllowedOrigins,
    oauthRedirectBase,
  },
  session,
  oauth,
  rateLimit,
};

module.exports = Object.freeze(config);
