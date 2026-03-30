const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { strictEqual, ok } = require('node:assert/strict');
const { mock } = require('node:test');
const { StravaUpstreamError } = require('../../../src/errors');

describe('strava-oauth-service exchangeAuthorizationCode', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = mock.method(global, 'fetch', async () => ({
      ok: true,
      json: async () => ({
        access_token: 'tok',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }),
    }));
  });

  afterEach(() => {
    fetchMock.mock.restore();
  });

  it('returns accessToken and expiresAtMs on success', async () => {
    const { exchangeAuthorizationCode } = require('../../../src/services/strava-oauth-service');
    const out = await exchangeAuthorizationCode('  code123  ');
    strictEqual(out.accessToken, 'tok');
    ok(Number.isFinite(out.expiresAtMs));
  });

  it('throws StravaUpstreamError when code is missing', async () => {
    const { exchangeAuthorizationCode } = require('../../../src/services/strava-oauth-service');
    await assert.rejects(
      () => exchangeAuthorizationCode(''),
      (e) => e instanceof StravaUpstreamError && e.message.includes('Missing')
    );
  });

  it('throws when Strava returns non-OK', async () => {
    fetchMock.mock.restore();
    fetchMock = mock.method(global, 'fetch', async () => ({ ok: false, status: 400 }));
    const { exchangeAuthorizationCode } = require('../../../src/services/strava-oauth-service');
    await assert.rejects(
      () => exchangeAuthorizationCode('c'),
      (e) => e instanceof StravaUpstreamError
    );
  });

  it('throws when access_token missing in body', async () => {
    fetchMock.mock.restore();
    fetchMock = mock.method(global, 'fetch', async () => ({
      ok: true,
      json: async () => ({ expires_at: 1 }),
    }));
    const { exchangeAuthorizationCode } = require('../../../src/services/strava-oauth-service');
    await assert.rejects(
      () => exchangeAuthorizationCode('c'),
      (e) => e instanceof StravaUpstreamError && e.message.includes('Invalid Strava token response')
    );
  });

  it('throws when expires_at is invalid', async () => {
    fetchMock.mock.restore();
    fetchMock = mock.method(global, 'fetch', async () => ({
      ok: true,
      json: async () => ({ access_token: 't', expires_at: 'not-a-number' }),
    }));
    const { exchangeAuthorizationCode } = require('../../../src/services/strava-oauth-service');
    await assert.rejects(
      () => exchangeAuthorizationCode('c'),
      (e) => e instanceof StravaUpstreamError && e.message.includes('expiry')
    );
  });
});
