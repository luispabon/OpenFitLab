const { describe, it, mock, afterEach } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const session = require('express-session');
const authRouter = require('../../../src/routes/auth');
const authService = require('../../../src/services/auth-service');
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

  function createApp() {
    const app = express();
    app.use(
      session({
        secret: 'test-secret-at-least-32-characters-long',
        resave: false,
        saveUninitialized: true,
        cookie: { httpOnly: true },
      })
    );
    app.use((req, res, next) => {
      req.csrfToken = () => 'csrf-test';
      next();
    });
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
    const app = express();
    app.use(
      session({
        secret: 'test-secret-at-least-32-characters-long',
        resave: false,
        saveUninitialized: true,
        cookie: { httpOnly: true },
      })
    );
    app.use((req, res, next) => {
      req.csrfToken = () => 'csrf-test';
      next();
    });
    app.use((req, res, next) => {
      req.session.userId = 'ghost';
      next();
    });
    app.use('/api/auth', authRouter);
    app.use(errorHandler);
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
    const app = express();
    app.use(
      session({
        secret: 'test-secret-at-least-32-characters-long',
        resave: false,
        saveUninitialized: true,
        cookie: { httpOnly: true },
      })
    );
    app.use((req, res, next) => {
      req.csrfToken = () => 'csrf-test';
      next();
    });
    app.use((req, res, next) => {
      req.session.userId = 'u1';
      next();
    });
    app.use('/api/auth', authRouter);
    app.use(errorHandler);
    const res = await request(app).get('/api/auth/me');
    strictEqual(res.status, 200);
    strictEqual(res.body.id, 'u1');
    strictEqual(res.body.displayName, 'Alice');
    strictEqual(res.body.csrfToken, 'csrf-test');
  });

  it('GET /me returns pending signup shape', async () => {
    const app = express();
    app.use(
      session({
        secret: 'test-secret-at-least-32-characters-long',
        resave: false,
        saveUninitialized: true,
        cookie: { httpOnly: true },
      })
    );
    app.use((req, res, next) => {
      req.csrfToken = () => 'csrf-test';
      next();
    });
    app.use((req, res, next) => {
      req.session.pendingSignup = { displayName: 'P', avatarUrl: null };
      next();
    });
    app.use('/api/auth', authRouter);
    app.use(errorHandler);
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
