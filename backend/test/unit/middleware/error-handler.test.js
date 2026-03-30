const { describe, it } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const { errorHandler } = require('../../../src/middleware/error-handler');
const { StravaRateLimitError } = require('../../../src/errors');

function makeRes() {
  let statusCode = 200;
  let body = null;
  const headers = {};
  const res = {
    headersSent: false,
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      body = data;
      return res;
    },
    set(name, val) {
      headers[name] = val;
      return res;
    },
    getStatusCode: () => statusCode,
    getBody: () => body,
    getHeader: (n) => headers[n],
  };
  return res;
}

describe('error-handler', () => {
  it('returns 500 with generic message when err has no statusCode', () => {
    const res = makeRes();
    let nextCalled = false;
    const next = (err) => {
      nextCalled = true;
      strictEqual(err.message, 'boom');
    };
    errorHandler(new Error('boom'), {}, res, next);
    strictEqual(res.getStatusCode(), 500);
    strictEqual(res.getBody().error, 'boom');
    strictEqual(nextCalled, false);
  });

  it('returns 404 when err.statusCode is 404', () => {
    const res = makeRes();
    const err = new Error('missing');
    err.statusCode = 404;
    errorHandler(err, {}, res, () => {});
    strictEqual(res.getStatusCode(), 404);
    strictEqual(res.getBody().error, 'missing');
  });

  it('maps EBADCSRFTOKEN to 403 with fixed message', () => {
    const res = makeRes();
    const err = new Error('csrf');
    err.code = 'EBADCSRFTOKEN';
    errorHandler(err, {}, res, () => {});
    strictEqual(res.getStatusCode(), 403);
    strictEqual(res.getBody().error, 'Invalid or missing CSRF token');
  });

  it('sets Retry-After for StravaRateLimitError', () => {
    const res = makeRes();
    const err = new StravaRateLimitError(120);
    errorHandler(err, {}, res, () => {});
    strictEqual(res.getStatusCode(), 429);
    strictEqual(res.getHeader('Retry-After'), '120');
  });

  it('caps Retry-After at 86400', () => {
    const res = makeRes();
    const err = new StravaRateLimitError(999999);
    errorHandler(err, {}, res, () => {});
    strictEqual(res.getHeader('Retry-After'), '86400');
  });

  it('calls next(err) when headers already sent', () => {
    const res = makeRes();
    res.headersSent = true;
    const err = new Error('late');
    let passed = null;
    errorHandler(err, {}, res, (e) => {
      passed = e;
    });
    strictEqual(passed, err);
  });

  it('uses default message when err has no message', () => {
    const res = makeRes();
    errorHandler({}, {}, res, () => {});
    strictEqual(res.getBody().error, 'Internal server error');
  });
});
