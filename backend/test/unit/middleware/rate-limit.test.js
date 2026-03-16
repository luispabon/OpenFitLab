const { describe, it, after } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');

// Config is loaded when rate-limit is required; SESSION_SECRET is required by config
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'a'.repeat(32);

const {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  callbackLimiter,
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

// Ensure test process exits even if express-rate-limit leaves timers running
after(() => {
  // Give a microtask turn for any pending logs, then exit
  setImmediate(() => process.exit(0));
});
