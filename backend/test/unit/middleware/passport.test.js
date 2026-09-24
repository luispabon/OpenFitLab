const { describe, it, afterEach } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
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
