const { describe, it, mock, afterEach } = require('node:test');
const { strictEqual, deepStrictEqual, ok } = require('node:assert/strict');
const express = require('express');
const passport = require('passport');
const request = require('supertest');
const authRouter = require('../../../src/routes/auth');
const authService = require('../../../src/services/auth-service');
const config = require('../../../src/config');
const { csrfProtection } = require('../../../src/middleware/csrf');
const { errorHandler } = require('../../../src/middleware/error-handler');
const { APPLE_STATE_COOKIE } = require('../../../src/middleware/oauth-state');

describe('auth routes', () => {
  const restores = [];

  afterEach(() => {
    for (const r of restores) {
      try {
        r.mock.restore();
      } catch {
        /* */
      }
    }
    restores.length = 0;
  });

  function stubSession(fields = {}) {
    return (req, res, next) => {
      req.session = {
        destroy(cb) {
          if (cb) cb();
        },
        cookie: {},
        ...fields,
      };
      next();
    };
  }

  function createApp(sessionFields = {}) {
    const app = express();
    app.use(stubSession(sessionFields));
    app.use(csrfProtection);
    app.use('/api/auth', authRouter);
    app.use(errorHandler);
    return app;
  }

  it('GET /me returns 401 when not authenticated', async () => {
    const app = createApp();
    const res = await request(app).get('/api/auth/me');
    strictEqual(res.status, 401);
  });

  it('GET /me returns 401 when user missing in DB', async () => {
    restores.push(mock.method(authService, 'getCurrentUserForMe', async () => null));
    const app = createApp({ userId: 'ghost' });
    const res2 = await request(app).get('/api/auth/me');
    strictEqual(res2.status, 401);
  });

  it('GET /me returns user when session has userId', async () => {
    restores.push(
      mock.method(authService, 'getCurrentUserForMe', async () => ({
        id: 'u1',
        displayName: 'Alice',
        avatarUrl: null,
      }))
    );
    const app = createApp({ userId: 'u1' });
    const res = await request(app).get('/api/auth/me');
    strictEqual(res.status, 200);
    strictEqual(res.body.id, 'u1');
    strictEqual(res.body.displayName, 'Alice');
    strictEqual(typeof res.body.csrfToken, 'string');
    ok(res.body.csrfToken.length > 0);
  });

  it('GET /me returns pending signup shape', async () => {
    // Ensure CSRF middleware is not ignored so it can generate a token.
    const app = createApp({
      userId: 'pending-user',
      pendingSignup: { displayName: 'P', avatarUrl: null },
    });
    const res = await request(app).get('/api/auth/me');
    strictEqual(res.status, 200);
    strictEqual(res.body.pendingSignup, true);
    strictEqual(res.body.profile.displayName, 'P');
  });

  describe('GET /providers', () => {
    const snapshot = {
      google: config.oauth.google.enabled,
      github: config.oauth.github.enabled,
      apple: config.oauth.apple.enabled,
      facebook: config.oauth.facebook.enabled,
    };

    afterEach(() => {
      config.oauth.google.enabled = snapshot.google;
      config.oauth.github.enabled = snapshot.github;
      config.oauth.apple.enabled = snapshot.apple;
      config.oauth.facebook.enabled = snapshot.facebook;
    });

    it('returns the four capability booleans without requiring a session', async () => {
      const app = createApp();
      const res = await request(app).get('/api/auth/providers');
      strictEqual(res.status, 200);
      for (const provider of ['google', 'github', 'apple', 'facebook']) {
        strictEqual(typeof res.body[provider], 'boolean');
      }
    });

    it('reflects config.oauth enabled flags and exposes no other fields', async () => {
      config.oauth.google.enabled = true;
      config.oauth.github.enabled = false;
      config.oauth.apple.enabled = true;
      config.oauth.facebook.enabled = false;
      const app = createApp();
      const res = await request(app).get('/api/auth/providers');
      strictEqual(res.status, 200);
      deepStrictEqual(res.body, { google: true, github: false, apple: true, facebook: false });
    });
  });

  it('POST /logout returns ok', async () => {
    const app = createApp();
    const res = await request(app).post('/api/auth/logout');
    strictEqual(res.status, 200);
    strictEqual(res.body.ok, true);
  });

  it('POST /complete-signup returns 400 when no pending', async () => {
    const app = createApp();
    const res = await request(app).post('/api/auth/complete-signup');
    strictEqual(res.status, 400);
    ok(res.body.error);
  });

  it('POST /decline-signup returns ok', async () => {
    const app = createApp();
    const res = await request(app).post('/api/auth/decline-signup');
    strictEqual(res.status, 200);
    strictEqual(res.body.ok, true);
  });

  describe('Apple OAuth state cookie', () => {
    const wasEnabled = config.oauth.apple.enabled;

    afterEach(() => {
      config.oauth.apple.enabled = wasEnabled;
      delete passport._strategies?.apple;
    });

    it('GET /apple sets a scoped, HttpOnly state cookie', async () => {
      config.oauth.apple.enabled = true;
      passport.use('apple', {
        authenticate() {
          this.redirect('https://appleid.apple.com/auth/authorize?state=x');
        },
      });
      const app = createApp();
      const res = await request(app).get('/api/auth/apple');
      strictEqual(res.status, 302);
      const setCookie = res.headers['set-cookie'].find((c) => c.startsWith(`${APPLE_STATE_COOKIE}=`));
      ok(setCookie, 'state cookie should be set');
      ok(setCookie.includes('HttpOnly'));
      ok(setCookie.includes('Path=/api/auth/apple/callback'));
    });

    it('POST /apple/callback redirects to login failure when state cookie is missing', async () => {
      config.oauth.apple.enabled = true;
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/apple/callback')
        .type('form')
        .send({ state: 'some-state' });
      strictEqual(res.status, 302);
      ok(res.headers.location.includes('error=apple'));
    });

    it('POST /apple/callback redirects to login failure when state mismatches the cookie', async () => {
      config.oauth.apple.enabled = true;
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/apple/callback')
        .set('Cookie', [`${APPLE_STATE_COOKIE}=${'a'.repeat(64)}`])
        .type('form')
        .send({ state: 'b'.repeat(64) });
      strictEqual(res.status, 302);
      ok(res.headers.location.includes('error=apple'));
    });

    it('POST /apple/callback redirects to login failure on malformed user JSON, without a 500', async () => {
      config.oauth.apple.enabled = true;
      const state = 'c'.repeat(64);
      const app = createApp();
      const res = await request(app)
        .post('/api/auth/apple/callback')
        .set('Cookie', [`${APPLE_STATE_COOKIE}=${state}`])
        .type('form')
        .send(`state=${state}&user=${encodeURIComponent('{not valid json')}`);
      strictEqual(res.status, 302);
      ok(res.headers.location.includes('error=apple'));
    });
  });
});
