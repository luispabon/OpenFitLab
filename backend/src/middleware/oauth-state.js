/**
 * Apple Sign In CSRF protection.
 *
 * Apple's callback is a cross-site POST (`response_mode: form_post`), so the
 * `ofl.sid` session cookie (SameSite=Lax) is not sent and passport-oauth2's
 * session-backed NonceStore cannot be used (see middleware/passport.js).
 * Instead a dedicated, short-lived, single-purpose cookie carries the state
 * value across the redirect: `GET /api/auth/apple` sets it, and
 * `verifyAppleState` checks it against the value Apple posts back before
 * `passport.authenticate('apple', ...)` runs.
 *
 * Dev limitation: without HTTPS, the cookie is set as `SameSite=Lax` (since
 * `SameSite=None` requires `Secure`), which browsers do not send on Apple's
 * cross-site POST. Apple Sign In therefore only works end-to-end over HTTPS
 * (i.e. in production, or a local HTTPS tunnel).
 */

const crypto = require('crypto');
const config = require('../config');

const APPLE_STATE_COOKIE = 'ofl.apple_state';
const APPLE_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const APPLE_CALLBACK_PATH = '/api/auth/apple/callback';

function generateAppleState() {
  return crypto.randomBytes(32).toString('hex');
}

function appleStateCookieOptions() {
  const secure = config.session.cookieSecure;
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: APPLE_CALLBACK_PATH,
  };
}

function setAppleStateCookie(res, state) {
  res.cookie(APPLE_STATE_COOKIE, state, {
    ...appleStateCookieOptions(),
    maxAge: APPLE_STATE_MAX_AGE_MS,
  });
}

function clearAppleStateCookie(res) {
  res.clearCookie(APPLE_STATE_COOKIE, appleStateCookieOptions());
}

function parseCookieHeader(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      // Malformed %-encoding in an unrelated cookie must not break this request.
      cookies[key] = value;
    }
  }
  return cookies;
}

/**
 * Constant-time comparison that tolerates differing lengths (raw
 * `crypto.timingSafeEqual` throws on a length mismatch).
 */
function safeEqual(a, b) {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function appleFailureRedirect(res) {
  res.redirect(`${config.server.oauthRedirectBase}/#/login?error=apple`);
}

/**
 * Verifies the Apple `state` cookie against the value Apple posted back.
 * Always clears the cookie. Redirects to the login failure page on
 * mismatch or missing values instead of calling `next()`.
 */
function verifyAppleState(req, res, next) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const cookieState = cookies[APPLE_STATE_COOKIE];
  const postedState = req.body?.state;
  clearAppleStateCookie(res);

  if (
    typeof cookieState !== 'string' ||
    !cookieState ||
    typeof postedState !== 'string' ||
    !postedState ||
    !safeEqual(cookieState, postedState)
  ) {
    return appleFailureRedirect(res);
  }
  next();
}

/**
 * Guards against passport-apple's unguarded `JSON.parse(req.body.user)`,
 * which otherwise throws a 500 on a malformed `user` field.
 */
function validateAppleUser(req, res, next) {
  const rawUser = req.body?.user;
  if (rawUser === undefined) return next();
  if (typeof rawUser !== 'string') {
    return appleFailureRedirect(res);
  }
  try {
    JSON.parse(rawUser);
  } catch {
    return appleFailureRedirect(res);
  }
  next();
}

module.exports = {
  APPLE_STATE_COOKIE,
  APPLE_STATE_MAX_AGE_MS,
  generateAppleState,
  setAppleStateCookie,
  clearAppleStateCookie,
  verifyAppleState,
  validateAppleUser,
};
