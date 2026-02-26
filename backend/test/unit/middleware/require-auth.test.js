const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const { requireAuth } = require('../../../src/middleware/require-auth');

function makeFakeRes() {
  let statusCode = null;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      body = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getBody: () => body,
  };
  return res;
}

describe('require-auth middleware', () => {
  it('returns 401 when session is missing', () => {
    const req = {};
    const res = makeFakeRes();
    let nextCalled = false;

    requireAuth(req, res, () => {
      nextCalled = true;
    });

    strictEqual(res.getStatusCode(), 401);
    deepStrictEqual(res.getBody(), { error: 'Authentication required' });
    strictEqual(nextCalled, false);
  });

  it('returns 401 when session exists but userId is missing', () => {
    const req = { session: {} };
    const res = makeFakeRes();
    let nextCalled = false;

    requireAuth(req, res, () => {
      nextCalled = true;
    });

    strictEqual(res.getStatusCode(), 401);
    strictEqual(nextCalled, false);
  });

  it('returns 401 when session.userId is null', () => {
    const req = { session: { userId: null } };
    const res = makeFakeRes();
    let nextCalled = false;

    requireAuth(req, res, () => {
      nextCalled = true;
    });

    strictEqual(res.getStatusCode(), 401);
    strictEqual(nextCalled, false);
  });

  it('returns 401 when session.userId is undefined', () => {
    const req = { session: { userId: undefined } };
    const res = makeFakeRes();
    let nextCalled = false;

    requireAuth(req, res, () => {
      nextCalled = true;
    });

    strictEqual(res.getStatusCode(), 401);
    strictEqual(nextCalled, false);
  });

  it('returns 401 when session.userId is empty string', () => {
    const req = { session: { userId: '' } };
    const res = makeFakeRes();
    let nextCalled = false;

    requireAuth(req, res, () => {
      nextCalled = true;
    });

    strictEqual(res.getStatusCode(), 401);
    strictEqual(nextCalled, false);
  });

  it('calls next and sets req.userId when session has valid userId', () => {
    const req = { session: { userId: 'user-123' } };
    const res = makeFakeRes();
    let nextCalled = false;

    requireAuth(req, res, () => {
      nextCalled = true;
    });

    strictEqual(nextCalled, true);
    strictEqual(req.userId, 'user-123');
    strictEqual(res.getStatusCode(), null);
  });

  it('preserves existing req properties when attaching userId', () => {
    const req = { session: { userId: 'u1' }, params: { id: 'abc' } };
    const res = makeFakeRes();

    requireAuth(req, res, () => {});

    strictEqual(req.userId, 'u1');
    strictEqual(req.params.id, 'abc');
  });
});
