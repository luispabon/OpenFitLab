const { describe, it, mock, afterEach } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const authRouter = require('../../../src/routes/auth');
const authService = require('../../../src/services/auth-service');
const { csrfProtection } = require('../../../src/middleware/csrf');
const { errorHandler } = require('../../../src/middleware/error-handler');

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
});
