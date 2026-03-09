const { describe, it } = require('node:test');
const { strictEqual, ok, deepStrictEqual } = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Set required env before loading config (config validates SESSION_SECRET at load time)
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'a'.repeat(32);

const config = require('../../src/config');

const backendDir = path.join(__dirname, '..', '..');

function loadConfigInChild(envOverrides = {}) {
  const env = { ...process.env, ...envOverrides };
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    env.SESSION_SECRET = 'a'.repeat(32);
  }
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `
      const c = require('./src/config');
      console.log(JSON.stringify({ port: c.server.port, corsAllowedOrigins: c.server.corsAllowedOrigins }));
      `,
    ],
    { cwd: backendDir, env, encoding: 'utf8' }
  );
  return result;
}

describe('config', () => {
  it('exports expected top-level keys', () => {
    ok(config.db);
    ok(config.server);
    ok(config.session);
    ok(config.valkey);
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
    ok(
      config.server.corsAllowedOrigins === true || Array.isArray(config.server.corsAllowedOrigins)
    );
    strictEqual(typeof config.server.oauthRedirectBase, 'string');
  });

  it('session has secret and cookieSecure', () => {
    strictEqual(typeof config.session.secret, 'string');
    strictEqual(config.session.secret.length >= 32, true);
    strictEqual(typeof config.session.cookieSecure, 'boolean');
  });

  it('valkey has host, port, and url', () => {
    strictEqual(typeof config.valkey.host, 'string');
    strictEqual(typeof config.valkey.port, 'number');
    strictEqual(config.valkey.url === null || typeof config.valkey.url === 'string', true);
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

  describe('PORT (loaded in child process)', () => {
    it('uses PORT when set to valid number', () => {
      const result = loadConfigInChild({ PORT: '4000' });
      strictEqual(result.status, 0, result.stderr || result.error?.message);
      const out = JSON.parse(result.stdout.trim());
      strictEqual(out.port, 4000);
    });

    it('clamps PORT above 65535 to 65535', () => {
      const result = loadConfigInChild({ PORT: '99999' });
      strictEqual(result.status, 0, result.stderr || result.error?.message);
      const out = JSON.parse(result.stdout.trim());
      strictEqual(out.port, 65535);
    });

    it('clamps PORT below 1 to 1', () => {
      const result = loadConfigInChild({ PORT: '0' });
      strictEqual(result.status, 0, result.stderr || result.error?.message);
      const out = JSON.parse(result.stdout.trim());
      strictEqual(out.port, 1);
    });

    it('defaults port to 3000 when PORT is NaN or invalid', () => {
      const result = loadConfigInChild({ PORT: 'not-a-number' });
      strictEqual(result.status, 0, result.stderr || result.error?.message);
      const out = JSON.parse(result.stdout.trim());
      strictEqual(out.port, 3000);
    });
  });

  describe('corsAllowedOrigins in production', () => {
    it('parses ALLOWED_ORIGINS into trimmed array when NODE_ENV=production', () => {
      const result = loadConfigInChild({
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://a.com, https://b.com  ,  https://c.com',
      });
      strictEqual(result.status, 0, result.stderr || result.error?.message);
      const out = JSON.parse(result.stdout.trim());
      deepStrictEqual(out.corsAllowedOrigins, ['https://a.com', 'https://b.com', 'https://c.com']);
    });
  });

  describe('SESSION_SECRET validation (loaded in child process)', () => {
    it('throws when SESSION_SECRET is unset', () => {
      const env = { ...process.env };
      delete env.SESSION_SECRET;
      const result = spawnSync(process.execPath, ['-e', "require('./src/config');"], {
        cwd: backendDir,
        env,
        encoding: 'utf8',
      });
      strictEqual(result.status, 1);
      ok(
        (result.stderr + result.stdout).includes('SESSION_SECRET') &&
          (result.stderr + result.stdout).includes('32 characters'),
        'stderr or stdout should mention SESSION_SECRET and 32 characters'
      );
    });

    it('throws when SESSION_SECRET is shorter than 32 characters', () => {
      const result = spawnSync(process.execPath, ['-e', "require('./src/config');"], {
        cwd: backendDir,
        env: { ...process.env, SESSION_SECRET: 'short' },
        encoding: 'utf8',
      });
      strictEqual(result.status, 1);
      ok(
        (result.stderr + result.stdout).includes('SESSION_SECRET') &&
          (result.stderr + result.stdout).includes('32 characters'),
        'stderr or stdout should mention SESSION_SECRET and 32 characters'
      );
    });
  });
});
