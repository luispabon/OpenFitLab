const config = require('../config');
const { StravaUpstreamError } = require('../errors');

/**
 * Exchange Strava authorization code for short-lived access token (refresh token discarded).
 * @param {string} code
 * @returns {Promise<{ accessToken: string, expiresAtMs: number }>}
 */
async function exchangeAuthorizationCode(code) {
  if (!code || typeof code !== 'string' || !code.trim()) {
    throw new StravaUpstreamError('Missing authorization code');
  }
  const { clientId, clientSecret } = config.integrations.strava;
  const redirectUri = `${config.oauth.callbackUrl}/api/integrations/strava/callback`;
  const body = new URLSearchParams({
    client_id: String(clientId),
    client_secret: String(clientSecret),
    code: code.trim(),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    throw new StravaUpstreamError('Strava token exchange failed');
  }
  const data = await res.json();
  if (!data.access_token || data.expires_at == null) {
    throw new StravaUpstreamError('Invalid Strava token response');
  }
  const expiresAtMs = Number(data.expires_at) * 1000;
  if (!Number.isFinite(expiresAtMs)) {
    throw new StravaUpstreamError('Invalid Strava token expiry');
  }
  return {
    accessToken: String(data.access_token),
    expiresAtMs,
  };
}

module.exports = { exchangeAuthorizationCode };
