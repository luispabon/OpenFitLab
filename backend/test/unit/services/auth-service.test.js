const { describe, it, afterEach } = require('node:test');
const assert = require('node:assert');
const { strictEqual, ok } = require('node:assert/strict');
const { mock } = require('node:test');
const config = require('../../../src/config');
const userRepository = require('../../../src/repositories/user-repository');
const { ValidationError } = require('../../../src/errors');

describe('auth-service', () => {
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

  it('integrationsCapabilities exposes Strava configured flag', () => {
    const { integrationsCapabilities } = require('../../../src/services/auth-service');
    const caps = integrationsCapabilities();
    strictEqual(typeof caps.providers.strava.configured, 'boolean');
  });

  it('handleOAuthCallback sets pending signup session and returns redirect', async () => {
    const { handleOAuthCallback } = require('../../../src/services/auth-service');
    const calls = { regen: 0, save: 0 };
    const req = {
      user: {
        pendingSignup: true,
        profile: { displayName: 'A', avatarUrl: null, provider: 'google' },
      },
      session: {
        regenerate(fn) {
          calls.regen++;
          fn(null);
        },
        save(fn) {
          calls.save++;
          fn(null);
        },
        cookie: {},
      },
    };
    const url = await handleOAuthCallback(req);
    ok(url.includes('signup=pending'));
    strictEqual(req.session.pendingSignup.displayName, 'A');
    strictEqual(calls.regen, 1);
    strictEqual(calls.save, 1);
    strictEqual(req.session.cookie.maxAge, config.termsOfService.pendingSignupExpiryMs);
  });

  it('handleOAuthCallback sets userId for normal login', async () => {
    const { handleOAuthCallback } = require('../../../src/services/auth-service');
    const req = {
      user: { user: { id: 'user-uuid' } },
      session: {
        regenerate(fn) {
          fn(null);
        },
        save(fn) {
          fn(null);
        },
        cookie: {},
      },
    };
    const url = await handleOAuthCallback(req);
    ok(url.includes('login=success'));
    strictEqual(req.session.userId, 'user-uuid');
  });

  it('getCurrentUserForMe returns mapped user or null', async () => {
    restores.push(
      mock.method(userRepository, 'findById', async (id) =>
        id === 'u1'
          ? { id: 'u1', display_name: 'Bob', avatar_url: 'http://x' }
          : null
      )
    );
    const { getCurrentUserForMe } = require('../../../src/services/auth-service');
    const u = await getCurrentUserForMe('u1');
    strictEqual(u.displayName, 'Bob');
    strictEqual(u.avatarUrl, 'http://x');
    const missing = await getCurrentUserForMe('nope');
    strictEqual(missing, null);
  });

  it('completeSignup throws ValidationError without pending profile', async () => {
    const { completeSignup } = require('../../../src/services/auth-service');
    const req = { session: {} };
    await assert.rejects(
      () => completeSignup(req, { db: { query: async () => [] } }),
      (e) => e instanceof ValidationError
    );
  });

  it('completeSignup creates user and updates session', async () => {
    restores.push(
      mock.method(userRepository, 'createFromPendingProfile', async () => ({
        user: {
          id: 'new-id',
          display_name: 'New',
          avatar_url: null,
        },
      }))
    );
    const { completeSignup } = require('../../../src/services/auth-service');
    const req = {
      session: {
        pendingSignup: { provider: 'google', displayName: 'New' },
        cookie: {},
        save(fn) {
          fn(null);
        },
      },
    };
    const out = await completeSignup(req, { db: {} });
    strictEqual(out.id, 'new-id');
    strictEqual(req.session.userId, 'new-id');
    strictEqual(req.session.pendingSignup, undefined);
  });
});
