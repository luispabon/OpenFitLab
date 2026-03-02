const { describe, it } = require('node:test');
const { strictEqual } = require('node:assert/strict');
const { asyncHandler } = require('../../../src/middleware/async-handler');

describe('async-handler', () => {
  it('forwards resolved value without calling next with error', async () => {
    let called = false;
    const handler = asyncHandler(async (req, res) => {
      called = true;
      res.value = 42;
    });
    const req = {};
    const res = {};
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    await handler(req, res, next);

    strictEqual(called, true);
    strictEqual(nextCalled, false);
    strictEqual(res.value, 42);
  });

  it('passes rejected errors to next', async () => {
    const handler = asyncHandler(async () => {
      throw new Error('boom');
    });
    const req = {};
    const res = {};
    let passedError = null;
    const next = (err) => {
      passedError = err;
    };

    await handler(req, res, next);

    strictEqual(passedError instanceof Error, true);
    strictEqual(passedError.message, 'boom');
  });
});

