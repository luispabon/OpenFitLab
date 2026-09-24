const { describe, it } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const { errorHandler } = require('../../../src/middleware/error-handler');
const { StravaRateLimitError, StravaUpstreamError } = require('../../../src/errors');

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
    strictEqual(res.getBody().error, 'Internal server error');
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

  it('returns fixed StravaUpstreamError text without upstream detail (502)', () => {
    const res = makeRes();
    const err = new StravaUpstreamError('Strava API error (500)');
    err.upstreamMessage = 'some sensitive upstream detail';
    errorHandler(err, {}, res, () => {});
    strictEqual(res.getStatusCode(), 502);
    strictEqual(res.getBody().error, 'Strava API error (500)');
  });

  it('hides message of other 5xx errors', () => {
    const res = makeRes();
    const err = new Error('connect ECONNREFUSED 10.0.0.5:3306');
    err.statusCode = 503;
    errorHandler(err, {}, res, () => {});
    strictEqual(res.getStatusCode(), 503);
    strictEqual(res.getBody().error, 'Internal server error');
  });

  it('preserves typed 4xx message', () => {
    const res = makeRes();
    const err = new Error('name must be a non-empty string');
    err.statusCode = 400;
    errorHandler(err, {}, res, () => {});
    strictEqual(res.getStatusCode(), 400);
    strictEqual(res.getBody().error, 'name must be a non-empty string');
  });
});
