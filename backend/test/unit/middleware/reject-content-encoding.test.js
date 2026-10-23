const { describe, it } = require('node:test');
const { strictEqual, ok, deepStrictEqual } = require('node:assert/strict');
const { gzipSync } = require('node:zlib');
const express = require('express');
const request = require('supertest');
const { rejectContentEncoding } = require('../../../src/middleware/reject-content-encoding');
const { errorHandler } = require('../../../src/middleware/error-handler');
const { UnsupportedMediaTypeError } = require('../../../src/errors');

function runGuard(headers) {
  const calls = [];
  rejectContentEncoding({ headers }, {}, (...args) => calls.push(args));
  strictEqual(calls.length, 1);
  return calls[0];
}

function createApp({ withGuard = true } = {}) {
  const app = express();
  if (withGuard) app.use(rejectContentEncoding);
  app.use(express.json({ limit: '1mb', inflate: false }));
  app.post('/api/echo', (req, res) => res.json({ received: req.body }));
  app.use(errorHandler);
  return app;
}

describe('rejectContentEncoding middleware', () => {
  it('calls next() without error when Content-Encoding is absent or empty', () => {
    deepStrictEqual(runGuard({}), []);
    deepStrictEqual(runGuard({ 'content-encoding': '' }), []);
  });

  it('calls next() without error when every token is identity', () => {
    deepStrictEqual(runGuard({ 'content-encoding': 'identity' }), []);
    deepStrictEqual(runGuard({ 'content-encoding': 'IDENTITY' }), []);
    deepStrictEqual(runGuard({ 'content-encoding': ' identity , identity ' }), []);
  });

  it('passes an UnsupportedMediaTypeError with 415 for compressed encodings', () => {
    for (const value of ['gzip', 'br', 'deflate', 'gzip, br', 'identity, br']) {
      const [err] = runGuard({ 'content-encoding': value });
      ok(err instanceof UnsupportedMediaTypeError, `${value} should be rejected`);
      strictEqual(err.statusCode, 415);
      strictEqual(err.message, 'Unsupported Content-Encoding');
    }
  });
});

describe('rejectContentEncoding with express.json (inflate: false)', () => {
  it('accepts a plain JSON POST', async () => {
    const res = await request(createApp())
      .post('/api/echo')
      .set('Content-Type', 'application/json')
      .send({ a: 1 })
      .expect(200);
    deepStrictEqual(res.body, { received: { a: 1 } });
  });

  it('accepts an explicit identity Content-Encoding', async () => {
    const res = await request(createApp())
      .post('/api/echo')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'identity')
      .send({ a: 1 })
      .expect(200);
    deepStrictEqual(res.body, { received: { a: 1 } });
  });

  it('returns 415 { error } for a gzip-compressed JSON body', async () => {
    const res = await request(createApp())
      .post('/api/echo')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send(gzipSync(JSON.stringify({ a: 1 })))
      .expect(415);
    deepStrictEqual(res.body, { error: 'Unsupported Content-Encoding' });
  });

  it('returns 415 for a br header before the body is parsed', async () => {
    const res = await request(createApp())
      .post('/api/echo')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'br')
      .send(Buffer.from('not a brotli stream'))
      .expect(415);
    deepStrictEqual(res.body, { error: 'Unsupported Content-Encoding' });
  });

  it('returns 415 { error } from body-parser when the guard is absent', async () => {
    const res = await request(createApp({ withGuard: false }))
      .post('/api/echo')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send(gzipSync(JSON.stringify({ a: 1 })))
      .expect(415);
    deepStrictEqual(res.body, { error: 'Bad request' });
  });

  it('returns 415 for a gzip-compressed urlencoded body (inflate: false)', async () => {
    const app = express();
    app.use(rejectContentEncoding);
    app.use(express.urlencoded({ extended: true, inflate: false }));
    app.post('/form', (req, res) => res.json({ received: req.body }));
    app.use(errorHandler);
    const res = await request(app)
      .post('/form')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('Content-Encoding', 'gzip')
      .send(gzipSync('a=1'))
      .expect(415);
    deepStrictEqual(res.body, { error: 'Unsupported Content-Encoding' });
  });
});
