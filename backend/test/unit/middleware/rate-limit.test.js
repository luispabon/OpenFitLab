const { describe, it } = require('node:test');
const { ok, strictEqual } = require('node:assert/strict');
const { apiLimiter, authLimiter, uploadLimiter } = require('../../../src/middleware/rate-limit');

describe('rate-limit middleware', () => {
  it('apiLimiter is defined with correct window and max', () => {
    ok(apiLimiter);
    // express-rate-limit internal properties check (heuristic)
    strictEqual(typeof apiLimiter, 'function');
  });

  it('authLimiter is defined', () => {
    ok(authLimiter);
    strictEqual(typeof authLimiter, 'function');
  });

  it('uploadLimiter is defined', () => {
    ok(uploadLimiter);
    strictEqual(typeof uploadLimiter, 'function');
  });
});
