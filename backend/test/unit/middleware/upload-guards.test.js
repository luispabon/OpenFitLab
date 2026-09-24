const { describe, it } = require('node:test');
const { strictEqual } = require('node:assert/strict');
const multer = require('multer');

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'a'.repeat(32);

const {
  createContentLengthGuard,
  createUploadConcurrencyGuard,
  mapMulterError,
} = require('../../../src/middleware/upload-guards');

function makeReq({ userId = 'u1', contentType = 'multipart/form-data', contentLength } = {}) {
  const headers = {};
  if (contentLength !== undefined) headers['content-length'] = contentLength;
  return {
    userId,
    headers,
    is: (type) => (contentType && contentType.includes(type) ? contentType : false),
  };
}

function makeRes() {
  const listeners = {};
  return {
    on(event, cb) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    emit(event) {
      (listeners[event] || []).forEach((cb) => cb());
    },
  };
}

describe('createContentLengthGuard', () => {
  it('passes through non-multipart requests without checking Content-Length', () => {
    const guard = createContentLengthGuard({ maxBytes: 100 });
    const req = makeReq({ contentType: 'application/json', contentLength: undefined });
    let nextErr = 'not-called';
    guard(req, makeRes(), (err) => (nextErr = err));
    strictEqual(nextErr, undefined);
  });

  it('rejects multipart requests missing Content-Length with 411', () => {
    const guard = createContentLengthGuard({ maxBytes: 100 });
    const req = makeReq({ contentLength: undefined });
    let nextErr;
    guard(req, makeRes(), (err) => (nextErr = err));
    strictEqual(nextErr.statusCode, 411);
  });

  it('rejects multipart requests over the configured cap with 413', () => {
    const guard = createContentLengthGuard({ maxBytes: 100 });
    const req = makeReq({ contentLength: '101' });
    let nextErr;
    guard(req, makeRes(), (err) => (nextErr = err));
    strictEqual(nextErr.statusCode, 413);
  });

  it('allows multipart requests at or under the configured cap', () => {
    const guard = createContentLengthGuard({ maxBytes: 100 });
    const req = makeReq({ contentLength: '100' });
    let nextErr = 'not-called';
    guard(req, makeRes(), (err) => (nextErr = err));
    strictEqual(nextErr, undefined);
  });

  it('rejects an invalid (non-numeric) Content-Length with 411', () => {
    const guard = createContentLengthGuard({ maxBytes: 100 });
    const req = makeReq({ contentLength: 'not-a-number' });
    let nextErr;
    guard(req, makeRes(), (err) => (nextErr = err));
    strictEqual(nextErr.statusCode, 411);
  });
});

describe('createUploadConcurrencyGuard', () => {
  it('allows requests up to the per-user limit and blocks the next one', () => {
    const guard = createUploadConcurrencyGuard({ maxPerUser: 2 });
    const results = [];
    for (let i = 0; i < 3; i++) {
      guard(makeReq({ userId: 'u1' }), makeRes(), (err) => results.push(err));
    }
    strictEqual(results[0], undefined);
    strictEqual(results[1], undefined);
    strictEqual(results[2].statusCode, 429);
  });

  it('releases the slot on response finish, allowing a subsequent request through', () => {
    const guard = createUploadConcurrencyGuard({ maxPerUser: 1 });
    const res1 = makeRes();
    let err1;
    guard(makeReq({ userId: 'u1' }), res1, (err) => (err1 = err));
    strictEqual(err1, undefined);

    res1.emit('finish');

    let err2;
    guard(makeReq({ userId: 'u1' }), makeRes(), (err) => (err2 = err));
    strictEqual(err2, undefined);
  });

  it('releases exactly once even if both finish and close fire', () => {
    const guard = createUploadConcurrencyGuard({ maxPerUser: 1 });
    const res1 = makeRes();
    guard(makeReq({ userId: 'u1' }), res1, () => {});
    res1.emit('finish');
    res1.emit('close');

    let err2, err3;
    guard(makeReq({ userId: 'u1' }), makeRes(), (err) => (err2 = err));
    guard(makeReq({ userId: 'u1' }), makeRes(), (err) => (err3 = err));
    strictEqual(err2, undefined);
    strictEqual(err3.statusCode, 429);
  });

  it('tracks concurrency per user in isolation', () => {
    const guard = createUploadConcurrencyGuard({ maxPerUser: 1 });
    let errU1, errU2;
    guard(makeReq({ userId: 'u1' }), makeRes(), (err) => (errU1 = err));
    guard(makeReq({ userId: 'u2' }), makeRes(), (err) => (errU2 = err));
    strictEqual(errU1, undefined);
    strictEqual(errU2, undefined);
  });
});

describe('mapMulterError', () => {
  for (const code of [
    'LIMIT_FILE_SIZE',
    'LIMIT_FILE_COUNT',
    'LIMIT_PART_COUNT',
    'LIMIT_FIELD_KEY',
    'LIMIT_FIELD_VALUE',
    'LIMIT_FIELD_COUNT',
  ]) {
    it(`maps ${code} to a 413 error`, () => {
      const mapped = mapMulterError(new multer.MulterError(code, 'files'));
      strictEqual(mapped.statusCode, 413);
    });
  }

  it('maps LIMIT_UNEXPECTED_FILE to a 400 error', () => {
    const mapped = mapMulterError(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'files'));
    strictEqual(mapped.statusCode, 400);
  });

  it('returns non-multer errors unchanged', () => {
    const original = new Error('boom');
    strictEqual(mapMulterError(original), original);
  });
});
