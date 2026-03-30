process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || 'test-secret-at-least-32-characters-long';

const { describe, it, mock, afterEach } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const config = require('../../../src/config');
const stravaIntegration = require('../../../src/services/strava-integration-service');
const idempotency = require('../../../src/services/integration-idempotency');
const stravaOauth = require('../../../src/services/strava-oauth-service');
const { errorHandler } = require('../../../src/middleware/error-handler');

const STRAVA_ROUTER_PATH = require.resolve('../../../src/routes/integrations-strava');

function loadStravaRouter() {
  delete require.cache[STRAVA_ROUTER_PATH];
  return require('../../../src/routes/integrations-strava');
}

describe('integrations-strava routes', () => {
  const restores = [];
  let stravaEnabled;

  afterEach(() => {
    for (const r of restores) {
      try {
        r.mock.restore();
      } catch {
        /* */
      }
    }
    restores.length = 0;
    if (stravaEnabled !== undefined) {
      config.integrations.strava.enabled = stravaEnabled;
    }
    delete require.cache[STRAVA_ROUTER_PATH];
  });

  function attachSession(userId = 'u1', stravaSession = null) {
    return (req, res, next) => {
      req.session = {
        userId,
        ...(stravaSession ? { integrations: stravaSession } : {}),
      };
      next();
    };
  }

  it('GET /strava/status returns configured:false when Strava disabled', async () => {
    stravaEnabled = config.integrations.strava.enabled;
    config.integrations.strava.enabled = false;
    const stravaRouter = loadStravaRouter();
    const app = express();
    app.use(express.json());
    app.use(attachSession('u1'));
    app.use('/api/integrations', stravaRouter);
    app.use(errorHandler);
    const res = await request(app).get('/api/integrations/strava/status');
    strictEqual(res.status, 200);
    strictEqual(res.body.configured, false);
  });

  it('GET /strava/status returns connection when enabled', async () => {
    stravaEnabled = config.integrations.strava.enabled;
    config.integrations.strava.enabled = true;
    restores.push(
      mock.method(stravaIntegration, 'stravaConnectionStatus', () => ({
        connected: true,
        expiresAt: 999,
      }))
    );
    const stravaRouter = loadStravaRouter();
    const app = express();
    app.use(express.json());
    app.use(
      attachSession('u1', {
        strava: { accessToken: 't', expiresAt: Date.now() + 99999 },
      })
    );
    app.use('/api/integrations', stravaRouter);
    app.use(errorHandler);
    const res = await request(app).get('/api/integrations/strava/status');
    strictEqual(res.status, 200);
    strictEqual(res.body.configured, true);
    strictEqual(res.body.connected, true);
  });

  it('GET /strava/activities returns list when enabled', async () => {
    stravaEnabled = config.integrations.strava.enabled;
    config.integrations.strava.enabled = true;
    restores.push(
      mock.method(stravaIntegration, 'listStravaActivitiesForUser', async () => [
        { id: '1', name: 'Run' },
      ])
    );
    const stravaRouter = loadStravaRouter();
    const app = express();
    app.use(express.json());
    app.use(
      attachSession('u1', {
        strava: { accessToken: 't', expiresAt: Date.now() + 99999 },
      })
    );
    app.use('/api/integrations', stravaRouter);
    app.use(errorHandler);
    const res = await request(app).get('/api/integrations/strava/activities');
    strictEqual(res.status, 200);
    strictEqual(res.body.activities.length, 1);
  });

  it('POST /strava/import returns 409 on idempotency conflict', async () => {
    stravaEnabled = config.integrations.strava.enabled;
    config.integrations.strava.enabled = true;
    restores.push(
      mock.method(idempotency, 'importIdempotencyBegin', async () => ({ conflict: true }))
    );
    const stravaRouter = loadStravaRouter();
    const app = express();
    app.use(express.json());
    app.use(
      attachSession('u1', {
        strava: { accessToken: 't', expiresAt: Date.now() + 99999 },
      })
    );
    app.use('/api/integrations', stravaRouter);
    app.use(errorHandler);
    const res = await request(app)
      .post('/api/integrations/strava/import')
      .set('Idempotency-Key', 'k1')
      .send({ externalIds: ['1'] });
    strictEqual(res.status, 409);
    ok(res.body.error);
  });

  it('POST /strava/import replays completed body', async () => {
    stravaEnabled = config.integrations.strava.enabled;
    config.integrations.strava.enabled = true;
    restores.push(
      mock.method(idempotency, 'importIdempotencyBegin', async () => ({
        replay: true,
        body: { results: [{ ok: true }] },
      }))
    );
    const stravaRouter = loadStravaRouter();
    const app = express();
    app.use(express.json());
    app.use(attachSession('u1'));
    app.use('/api/integrations', stravaRouter);
    app.use(errorHandler);
    const res = await request(app)
      .post('/api/integrations/strava/import')
      .set('Idempotency-Key', 'k2')
      .send({ externalIds: ['1'] });
    strictEqual(res.status, 200);
    strictEqual(res.body.results[0].ok, true);
  });

  it('GET /strava/callback redirects on success', async () => {
    stravaEnabled = config.integrations.strava.enabled;
    config.integrations.strava.enabled = true;
    restores.push(
      mock.method(stravaOauth, 'exchangeAuthorizationCode', async () => ({
        accessToken: 'at',
        expiresAtMs: Date.now() + 1000,
      }))
    );
    const stravaRouter = loadStravaRouter();
    const app = express();
    app.use(
      require('express-session')({
        secret: 'test-secret-at-least-32-characters-long',
        resave: false,
        saveUninitialized: true,
      })
    );
    app.use((req, res, next) => {
      req.session.userId = 'u1';
      req.session.stravaOAuthState = { state: 'abc', createdAt: Date.now() };
      next();
    });
    app.use('/api/integrations', stravaRouter);
    app.use(errorHandler);
    const res = await request(app)
      .get('/api/integrations/strava/callback')
      .query({ code: 'c1', state: 'abc' })
      .redirects(0);
    strictEqual(res.status, 302);
    ok(res.headers.location.includes('import=1'));
  });
});
