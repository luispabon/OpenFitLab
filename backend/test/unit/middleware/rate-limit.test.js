const { describe, it, after } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');

// Config is loaded when rate-limit is required; SESSION_SECRET is required by config
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'a'.repeat(32);

const {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  callbackLimiter,
  createStore,
  attachRateLimitClient,
} = require('../../../src/middleware/rate-limit');

function makeReq(ip = '127.0.0.1', path = '/', method = 'GET') {
  return {
    ip,
    path,
    method,
    headers: {},
    get: (name) => undefined,
    app: {
      get: (name) => (name === 'trust proxy' ? false : undefined),
    },
  };
}

function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    finished: false,
    setHeader(key, val) {
      this.headers[key] = val;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      this.finished = true;
      return this;
    },
    send(obj) {
      // express-rate-limit may call res.send with an object
      this.body = obj;
      this.finished = true;
      return this;
    },
    end() {
      this.finished = true;
      return this;
    },
  };
  return res;
}

async function callLimiterNTimes(limiter, times, ip) {
  let nextCount = 0;
  let lastRes;
  for (let i = 0; i < times; i++) {
    const req = makeReq(ip);
    const res = makeRes();
    lastRes = res;
    await new Promise((resolve) => {
      // Wire resolve into the response methods so we capture async blocks
      const origJson = res.json.bind(res);
      const origSend = res.send.bind(res);
      const origEnd = res.end.bind(res);
      res.json = (obj) => {
        origJson(obj);
        resolve();
        return res;
      };
      res.send = (obj) => {
        origSend(obj);
        resolve();
        return res;
      };
      res.end = () => {
        origEnd();
        resolve();
        return res;
      };

      limiter(req, res, () => {
        nextCount++;
        resolve();
      });
    });
  }
  return { nextCount, lastRes };
}

describe('rate-limit middleware', () => {
  it('apiLimiter blocks after 500 requests per minute from same IP', async () => {
    const { nextCount, lastRes } = await callLimiterNTimes(apiLimiter, 501, '10.0.0.1');
    strictEqual(nextCount, 500);
    strictEqual(lastRes.statusCode, 429);
    ok(lastRes.body && typeof lastRes.body === 'object', 'should send JSON body');
    strictEqual(lastRes.body.error.includes('Too many requests'), true);
  });

  it('authLimiter blocks after 10 attempts per 15 minutes', async () => {
    const { nextCount, lastRes } = await callLimiterNTimes(authLimiter, 11, '10.0.0.2');
    strictEqual(nextCount, 10);
    strictEqual(lastRes.statusCode, 429);
    ok(lastRes.body && typeof lastRes.body === 'object');
    strictEqual(lastRes.body.error.includes('Too many login attempts'), true);
  });

  it('callbackLimiter blocks after 20 attempts per 15 minutes', async () => {
    const { nextCount, lastRes } = await callLimiterNTimes(callbackLimiter, 21, '10.0.0.3');
    strictEqual(nextCount, 20);
    strictEqual(lastRes.statusCode, 429);
  });

  it('uploadLimiter blocks after 50 uploads per 5 minutes', async () => {
    const { nextCount, lastRes } = await callLimiterNTimes(uploadLimiter, 51, '10.0.0.4');
    strictEqual(nextCount, 50);
    strictEqual(lastRes.statusCode, 429);
    ok(lastRes.body && typeof lastRes.body === 'object');
    strictEqual(lastRes.body.error.includes('Upload limit'), true);
  });
});

describe('rate-limit store selection', () => {
  it('returns undefined (in-memory store) when not production', () => {
    const store = createStore('rl:test:', false);
    strictEqual(store, undefined);
  });

  it('returns a RedisStore instance when production', () => {
    const store = createStore('rl:test:', true);
    strictEqual(store.constructor.name, 'RedisStore');
  });

  it('sendCommand waits for attachRateLimitClient before forwarding commands', async () => {
    const store = createStore('rl:test:shared:', true);
    const calls = [];
    const fakeClient = {
      sendCommand: async (args) => {
        calls.push(args);
        if (args[0] === 'SCRIPT') return 'deadbeef';
        return [1, 1000];
      },
    };

    const initPromise = store.init({ windowMs: 1000 });
    // Give init's SCRIPT LOAD calls a chance to run — they must not resolve without a client.
    await new Promise((resolve) => setImmediate(resolve));
    strictEqual(calls.length, 0);

    attachRateLimitClient(fakeClient);
    await initPromise;

    const result = await store.increment('some-key');
    strictEqual(result.totalHits, 1);
    ok(calls.some((args) => args[0] === 'EVALSHA'));
  });
});

// Ensure test process exits even if express-rate-limit leaves timers running
after(() => {
  // Give a microtask turn for any pending logs, then exit
  setImmediate(() => process.exit(0));
});

describe('mountAuthLimiters', () => {
  const express = require('express');
  const request = require('supertest');
  const { mountAuthLimiters } = require('../../../src/middleware/rate-limit');

  function createApp() {
    const hits = { auth: [], callback: [] };
    const app = express();
    mountAuthLimiters(app, {
      authLimiter: (req, res, next) => {
        hits.auth.push(req.originalUrl);
        next();
      },
      callbackLimiter: (req, res, next) => {
        hits.callback.push(req.originalUrl);
        next();
      },
    });
    app.all('/{*splat}', (req, res) => res.sendStatus(204));
    return { app, hits };
  }

  for (const provider of ['google', 'github', 'apple', 'facebook']) {
    it(`${provider}: login initiation hits only the auth limiter`, async () => {
      const { app, hits } = createApp();
      await request(app).get(`/api/auth/${provider}`).expect(204);
      strictEqual(hits.auth.length, 1);
      strictEqual(hits.callback.length, 0);
    });

    it(`${provider}: callback hits only the callback limiter`, async () => {
      const { app, hits } = createApp();
      const method = provider === 'apple' ? 'post' : 'get';
      await request(app)[method](`/api/auth/${provider}/callback?code=x&state=y`).expect(204);
      strictEqual(hits.auth.length, 0);
      strictEqual(hits.callback.length, 1);
    });
  }
});
