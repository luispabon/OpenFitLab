const { describe, it } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');

// Set required env before loading config (config validates SESSION_SECRET at load time)
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'a'.repeat(32);

const config = require('../../src/config');

describe('config', () => {
  it('exports expected top-level keys', () => {
    ok(config.db);
    ok(config.server);
    ok(config.session);
    ok(config.oauth);
    ok(config.rateLimit);
  });

  it('db has host, user, password, database', () => {
    strictEqual(typeof config.db.host, 'string');
    strictEqual(typeof config.db.user, 'string');
    strictEqual(typeof config.db.password, 'string');
    strictEqual(typeof config.db.database, 'string');
  });

  it('server has port, uploadDir, isProduction, corsAllowedOrigins, oauthRedirectBase', () => {
    strictEqual(typeof config.server.port, 'number');
    strictEqual(typeof config.server.uploadDir, 'string');
    strictEqual(typeof config.server.isProduction, 'boolean');
    ok(config.server.corsAllowedOrigins === true || Array.isArray(config.server.corsAllowedOrigins));
    strictEqual(typeof config.server.oauthRedirectBase, 'string');
  });

  it('session has secret and cookieSecure', () => {
    strictEqual(typeof config.session.secret, 'string');
    strictEqual(config.session.secret.length >= 32, true);
    strictEqual(typeof config.session.cookieSecure, 'boolean');
  });

  it('rateLimit.api has default max and windowMs', () => {
    strictEqual(typeof config.rateLimit.api.max, 'number');
    strictEqual(typeof config.rateLimit.api.windowMs, 'number');
    strictEqual(config.rateLimit.api.max >= 1, true);
    strictEqual(config.rateLimit.api.windowMs >= 1000, true);
  });

  it('config is frozen', () => {
    strictEqual(Object.isFrozen(config), true);
  });
});
