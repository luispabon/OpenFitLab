const express = require('express');
const crypto = require('crypto');
const config = require('../config');
const { asyncHandler } = require('../middleware/async-handler');
const { requireAuth } = require('../middleware/require-auth');
const { callbackLimiter, integrationLimiter } = require('../middleware/rate-limit');
const { ValidationError } = require('../errors');
const { exchangeAuthorizationCode } = require('../services/strava-oauth-service');
const {
  stravaConnectionStatus,
  listStravaActivitiesForUser,
  importStravaActivitiesByExternalIds,
} = require('../services/strava-integration-service');
const {
  importIdempotencyBegin,
  importIdempotencyComplete,
  importIdempotencyFail,
} = require('../services/integration-idempotency');
const { validateStravaActivitiesQuery, validateStravaImportBody } = require('../utils/validation');

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

const router = express.Router();

function stravaCallbackRedirect(res, queryWithoutQuestionMark) {
  const base = config.server.oauthRedirectBase;
  const q = queryWithoutQuestionMark.startsWith('?')
    ? queryWithoutQuestionMark.slice(1)
    : queryWithoutQuestionMark;
  res.redirect(`${base}/#/?${q}`);
}

router.get(
  '/strava/callback',
  callbackLimiter,
  asyncHandler(async (req, res) => {
    if (!config.integrations.strava.enabled) {
      return stravaCallbackRedirect(res, 'importError=config');
    }
    const { code, state, error } = req.query;
    if (error) {
      return stravaCallbackRedirect(
        res,
        `importError=strava&detail=${encodeURIComponent(String(error))}`
      );
    }
    if (!req.session?.userId) {
      return stravaCallbackRedirect(res, 'importError=session');
    }
    const stored = req.session.stravaOAuthState;
    if (!stored?.state || stored.state !== String(state || '')) {
      return stravaCallbackRedirect(res, 'importError=state');
    }
    if (Date.now() - (stored.createdAt || 0) > OAUTH_STATE_TTL_MS) {
      delete req.session.stravaOAuthState;
      return stravaCallbackRedirect(res, 'importError=expired');
    }
    delete req.session.stravaOAuthState;
    if (!code || typeof code !== 'string') {
      return stravaCallbackRedirect(res, 'importError=code');
    }
    const { accessToken, expiresAtMs } = await exchangeAuthorizationCode(code);
    req.session.integrations = req.session.integrations || {};
    req.session.integrations.strava = {
      accessToken,
      expiresAt: expiresAtMs,
    };
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    return stravaCallbackRedirect(res, 'import=1&provider=strava');
  })
);

router.use(requireAuth);

router.get(
  '/strava/authorize',
  asyncHandler(async (req, res) => {
    if (!config.integrations.strava.enabled) {
      throw new ValidationError('Strava is not configured on this server');
    }
    const state = crypto.randomBytes(24).toString('hex');
    req.session.stravaOAuthState = { state, createdAt: Date.now() };
    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });
    const redirectUri = `${config.oauth.callbackUrl}/api/integrations/strava/callback`;
    const params = new URLSearchParams({
      client_id: String(config.integrations.strava.clientId),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'activity:read_all',
      state,
    });
    res.redirect(`https://www.strava.com/oauth/authorize?${params.toString()}`);
  })
);

router.get(
  '/strava/status',
  asyncHandler(async (req, res) => {
    if (!config.integrations.strava.enabled) {
      return res.json({ configured: false });
    }
    const st = stravaConnectionStatus(req.session);
    return res.json({
      configured: true,
      connected: st.connected,
      expiresAt: st.expiresAt,
    });
  })
);

router.get(
  '/strava/activities',
  integrationLimiter,
  validateStravaActivitiesQuery,
  asyncHandler(async (req, res) => {
    if (!config.integrations.strava.enabled) {
      throw new ValidationError('Strava is not configured on this server');
    }
    const page = req.query.page != null ? Number(req.query.page) : 1;
    const perPage = req.query.perPage != null ? Number(req.query.perPage) : 30;
    const activities = await listStravaActivitiesForUser(
      req.session,
      { page, perPage },
      { userId: req.userId }
    );
    res.json({ activities });
  })
);

router.post(
  '/strava/import',
  integrationLimiter,
  validateStravaImportBody,
  asyncHandler(async (req, res) => {
    if (!config.integrations.strava.enabled) {
      throw new ValidationError('Strava is not configured on this server');
    }
    const idemRaw = req.get('Idempotency-Key');
    const idem = await importIdempotencyBegin(req.userId, idemRaw);
    if (idem.replay) {
      return res.json(idem.body);
    }
    if (idem.conflict) {
      return res.status(409).json({ error: 'Import already in progress for this request key' });
    }

    const { externalIds } = req.body;
    const folderId =
      req.body.folderId != null && req.body.folderId !== '' ? req.body.folderId : null;

    const redisKey = idem.redisKey;
    try {
      const body = await importStravaActivitiesByExternalIds(externalIds, folderId, req.session, {
        userId: req.userId,
      });
      const payload = { results: body.results };
      if (redisKey) {
        await importIdempotencyComplete(redisKey, payload);
      }
      res.json(payload);
    } catch (e) {
      await importIdempotencyFail(redisKey);
      throw e;
    }
  })
);

module.exports = router;
