const { describe, it } = require('node:test');
const { ok, strictEqual } = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const request = require('supertest');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'a'.repeat(32);

const { csrfProtection } = require('../../../src/middleware/csrf');
const { errorHandler } = require('../../../src/middleware/error-handler');

describe('csrfProtection', () => {
  it('bypasses csurf for anonymous requests so no session secret is written', () => {
    const req = { session: {}, method: 'GET', headers: {} };
    let nextCalled = false;
    csrfProtection(req, {}, () => {
      nextCalled = true;
    });
    strictEqual(nextCalled, true);
    strictEqual(req.csrfToken, undefined);
    strictEqual(req.session.csrfSecret, undefined);
  });

  it('runs csurf for an authenticated session and exposes req.csrfToken', () => {
    const req = { session: { userId: 'u1' }, method: 'GET', headers: {} };
    let nextCalled = false;
    csrfProtection(req, {}, (err) => {
      if (err) throw err;
      nextCalled = true;
    });
    strictEqual(nextCalled, true);
    strictEqual(typeof req.csrfToken, 'function');
    strictEqual(typeof req.session.csrfSecret, 'string');
  });

  it('runs csurf for a pending-signup session so complete-signup can mint a token', () => {
    const req = {
      session: { pendingSignup: { provider: 'github' } },
      method: 'GET',
      headers: {},
    };
    let nextCalled = false;
    csrfProtection(req, {}, (err) => {
      if (err) throw err;
      nextCalled = true;
    });
    strictEqual(nextCalled, true);
    strictEqual(typeof req.csrfToken, 'function');
  });

  it('does not start a session for an anonymous request (no Set-Cookie)', async () => {
    const app = express();
    app.set('trust proxy', true);
    app.use(
      session({
        secret: 's'.repeat(32),
        resave: false,
        saveUninitialized: false,
        cookie: { secure: true },
      })
    );
    app.use(csrfProtection);
    app.get('/probe', (req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const res = await request(app).get('/probe').set('X-Forwarded-Proto', 'https');
    strictEqual(res.status, 200);
    strictEqual(res.headers['set-cookie'], undefined);
  });

  it('enforces tokens for authenticated writes through the wrapper', async () => {
    const app = express();
    app.set('trust proxy', true);
    app.use(
      session({
        secret: 's'.repeat(32),
        resave: false,
        saveUninitialized: false,
        cookie: { secure: true },
      })
    );
    app.use((req, res, next) => {
      req.session.userId = 'u1';
      next();
    });
    app.use(csrfProtection);
    app.get('/token', (req, res) => res.json({ token: req.csrfToken() }));
    app.post('/probe', (req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const agent = request.agent(app);

    const noToken = await agent.post('/probe').set('X-Forwarded-Proto', 'https').send({});
    strictEqual(noToken.status, 403);

    const tokenRes = await agent.get('/token').set('X-Forwarded-Proto', 'https');
    strictEqual(tokenRes.status, 200);
    const sessionCookie = (tokenRes.headers['set-cookie'] ?? []).find((c) =>
      c.startsWith('connect.sid=')
    );
    ok(sessionCookie, 'expected a session cookie on the token response');
    ok(/;\s*Secure/i.test(sessionCookie), 'expected the session cookie to be Secure');

    // The agent does not replay Secure cookies over plain HTTP, so forward it explicitly.
    const okRes = await agent
      .post('/probe')
      .set('Cookie', sessionCookie.split(';')[0])
      .set('CSRF-Token', tokenRes.body.token)
      .set('X-Forwarded-Proto', 'https')
      .send({});
    strictEqual(okRes.status, 200);
  });
});
