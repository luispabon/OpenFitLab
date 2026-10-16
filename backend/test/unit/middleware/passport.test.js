const { describe, it, afterEach, mock } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'a'.repeat(32);

const config = require('../../../src/config');
const { configurePassport } = require('../../../src/middleware/passport');

describe('configurePassport OAuth state handling', () => {
  const originalOauth = JSON.parse(
    JSON.stringify({
      google: config.oauth.google,
      github: config.oauth.github,
      facebook: config.oauth.facebook,
    })
  );

  afterEach(() => {
    Object.assign(config.oauth.google, originalOauth.google);
    Object.assign(config.oauth.github, originalOauth.github);
    Object.assign(config.oauth.facebook, originalOauth.facebook);
  });

  it('registers Google with a session-backed state store (NonceStore), not NullStore', () => {
    config.oauth.google.enabled = true;
    config.oauth.google.clientId = 'gid';
    config.oauth.google.clientSecret = 'gsecret';
    const passport = configurePassport();
    const strategy = passport._strategy('google');
    strictEqual(strategy._stateStore.constructor.name, 'SessionStore');
  });

  it('registers GitHub with a session-backed state store (NonceStore), not NullStore', () => {
    config.oauth.github.enabled = true;
    config.oauth.github.clientId = 'ghid';
    config.oauth.github.clientSecret = 'ghsecret';
    const passport = configurePassport();
    const strategy = passport._strategy('github');
    strictEqual(strategy._stateStore.constructor.name, 'SessionStore');
  });

  it('registers Facebook with a session-backed state store (NonceStore), not NullStore', () => {
    config.oauth.facebook.enabled = true;
    config.oauth.facebook.clientId = 'fbid';
    config.oauth.facebook.clientSecret = 'fbsecret';
    const passport = configurePassport();
    const strategy = passport._strategy('facebook');
    strictEqual(strategy._stateStore.constructor.name, 'SessionStore');
  });

  it('rejects a request with an invalid (mismatched) state against the NonceStore', () => {
    config.oauth.google.enabled = true;
    config.oauth.google.clientId = 'gid';
    config.oauth.google.clientSecret = 'gsecret';
    const passport = configurePassport();
    const strategy = passport._strategy('google');

    const req = {
      query: { code: 'auth-code', state: 'wrong-state' },
      session: { 'oauth2:accounts.google.com': { state: 'expected-state' } },
    };

    let failInfo;
    strategy.fail = (info) => {
      failInfo = info;
    };
    strategy.error = (err) => {
      throw err;
    };
    strategy.authenticate(req, {});
    strictEqual(failInfo.message, 'Invalid authorization request state.');
  });

  it('rejects a request with no state stored in the session', () => {
    config.oauth.google.enabled = true;
    config.oauth.google.clientId = 'gid';
    config.oauth.google.clientSecret = 'gsecret';
    const passport = configurePassport();
    const strategy = passport._strategy('google');

    const req = {
      query: { code: 'auth-code', state: 'some-state' },
      session: {},
    };

    let failInfo;
    strategy.fail = (info) => {
      failInfo = info;
    };
    strategy.error = (err) => {
      throw err;
    };
    strategy.authenticate(req, {});
    strictEqual(failInfo.message, 'Unable to verify authorization request state.');
  });

  it('rejects a request with no state in the query string', () => {
    config.oauth.google.enabled = true;
    config.oauth.google.clientId = 'gid';
    config.oauth.google.clientSecret = 'gsecret';
    const passport = configurePassport();
    const strategy = passport._strategy('google');

    const req = {
      query: { code: 'auth-code' },
      session: { 'oauth2:accounts.google.com': { state: 'expected-state' } },
    };

    let failInfo;
    strategy.fail = (info) => {
      failInfo = info;
    };
    strategy.error = (err) => {
      throw err;
    };
    strategy.authenticate(req, {});
    strictEqual(failInfo.message, 'Invalid authorization request state.');
  });

  it('accepts a request whose state matches the stored nonce, consumes it, and rejects a replay', () => {
    config.oauth.google.enabled = true;
    config.oauth.google.clientId = 'gid';
    config.oauth.google.clientSecret = 'gsecret';
    const passport = configurePassport();
    const strategy = passport._strategy('google');
    strategy._oauth2.getOAuthAccessToken = (code, params, cb) => {
      cb(new Error('stop before network call'));
    };

    const req = {
      query: { code: 'auth-code', state: 'expected-state' },
      session: { 'oauth2:accounts.google.com': { state: 'expected-state' } },
    };

    let errored = false;
    strategy.fail = () => {
      throw new Error('should not fail with a matching state');
    };
    strategy.error = () => {
      errored = true;
    };
    strategy.authenticate(req, {});
    strictEqual(errored, true, 'reaches the token exchange step');
    strictEqual(req.session['oauth2:accounts.google.com'], undefined, 'nonce is consumed');

    // Replay: an attacker resending the same (now-consumed) state must fail.
    let replayFailInfo;
    strategy.fail = (info) => {
      replayFailInfo = info;
    };
    strategy.error = (err) => {
      throw err;
    };
    strategy.authenticate(req, {});
    strictEqual(replayFailInfo.message, 'Unable to verify authorization request state.');
  });

  it('initiation stores a nonce in the session and includes state in the redirect URL', () => {
    config.oauth.google.enabled = true;
    config.oauth.google.clientId = 'gid';
    config.oauth.google.clientSecret = 'gsecret';
    const passport = configurePassport();
    const strategy = passport._strategy('google');

    const req = { query: {}, session: {} };
    let redirectUrl;
    strategy.redirect = (url) => {
      redirectUrl = url;
    };
    strategy.error = (err) => {
      throw err;
    };
    strategy.authenticate(req, { scope: ['profile', 'email'] });

    ok(req.session['oauth2:accounts.google.com'].state, 'nonce stored in session');
    ok(redirectUrl.includes(`state=${req.session['oauth2:accounts.google.com'].state}`));
  });
});

describe('configurePassport GitHub email verification', () => {
  const originalGithub = { ...config.oauth.github };
  const userRepository = require('../../../src/repositories/user-repository');

  afterEach(() => {
    Object.assign(config.oauth.github, originalGithub);
  });

  function githubStrategy() {
    config.oauth.github.enabled = true;
    config.oauth.github.clientId = 'ghid';
    config.oauth.github.clientSecret = 'ghsecret';
    return configurePassport()._strategy('github');
  }

  function runVerify(strategy, profile) {
    return new Promise((resolve, reject) => {
      strategy._verify('token', null, profile, (err, out) => (err ? reject(err) : resolve(out)));
    });
  }

  it('does not trust an unverified primary GitHub email for account linking', async () => {
    const findIdentity = mock.method(userRepository, 'findIdentityByProvider', async () => null);
    const fetchMock = mock.method(globalThis, 'fetch', async () => ({
      ok: true,
      json: async () => [{ email: 'victim@example.com', primary: true, verified: false }],
    }));

    try {
      const result = await runVerify(githubStrategy(), {
        id: 'gh1',
        emails: [{ value: 'victim@example.com' }],
      });
      strictEqual(result.pendingSignup, true);
      ok(!result.profile.email, 'unverified email is not used for linking');
    } finally {
      findIdentity.mock.restore();
      fetchMock.mock.restore();
    }
  });

  it('links an existing account when GitHub reports a verified primary email', async () => {
    const findIdentity = mock.method(userRepository, 'findIdentityByProvider', async () => null);
    const findByEmail = mock.method(userRepository, 'findIdentitiesByEmail', async () => [
      { user_id: 'u1' },
    ]);
    const link = mock.method(userRepository, 'linkIdentity', async () => {});
    const findById = mock.method(userRepository, 'findById', async () => ({
      id: 'u1',
      displayName: 'Alice',
    }));
    const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
      strictEqual(url, 'https://api.github.com/user/emails');
      strictEqual(options.headers.Authorization, 'Bearer token');
      return {
        ok: true,
        json: async () => [{ email: 'alice@example.com', primary: true, verified: true }],
      };
    });

    try {
      const result = await runVerify(githubStrategy(), { id: 'gh2', emails: [{ value: 'x' }] });
      strictEqual(result.pendingSignup, false);
      strictEqual(result.user.id, 'u1');
      strictEqual(findByEmail.mock.callCount(), 1);
      strictEqual(link.mock.callCount(), 1);
      strictEqual(findById.mock.callCount(), 1);
    } finally {
      findIdentity.mock.restore();
      findByEmail.mock.restore();
      link.mock.restore();
      findById.mock.restore();
      fetchMock.mock.restore();
    }
  });

  it('treats a GitHub email lookup failure as unverified (no linking)', async () => {
    const findIdentity = mock.method(userRepository, 'findIdentityByProvider', async () => null);
    const fetchMock = mock.method(globalThis, 'fetch', async () => {
      throw new Error('network');
    });

    try {
      const result = await runVerify(githubStrategy(), {
        id: 'gh3',
        emails: [{ value: 'alice@example.com' }],
      });
      strictEqual(result.pendingSignup, true);
      ok(!result.profile.email);
    } finally {
      findIdentity.mock.restore();
      fetchMock.mock.restore();
    }
  });
});
