const { describe, it, beforeEach, afterEach } = require('node:test');
const { strictEqual, ok, deepStrictEqual } = require('node:assert/strict');
const { mock } = require('node:test');
const redisClient = require('../../../src/redis-client');

describe('integration-idempotency', () => {
  let getRedisClientMock;

  beforeEach(() => {
    const store = new Map();
    getRedisClientMock = mock.method(redisClient, 'getRedisClient', async () => ({
      async get(k) {
        const entry = store.get(k);
        return entry?.value ?? null;
      },
      async set(k, v, opts) {
        if (opts?.NX && store.has(k)) return null;
        store.set(k, { value: v, ex: opts?.EX });
        return 'OK';
      },
      async del(k) {
        store.delete(k);
      },
    }));
  });

  afterEach(() => {
    getRedisClientMock.mock.restore();
  });

  it('importIdempotencyBegin returns skip for empty key', async () => {
    const { importIdempotencyBegin } = require('../../../src/services/integration-idempotency');
    const r = await importIdempotencyBegin('u1', '');
    strictEqual(r.skip, true);
  });

  it('importIdempotencyBegin returns skip when raw key length > 200', async () => {
    const { importIdempotencyBegin } = require('../../../src/services/integration-idempotency');
    const r = await importIdempotencyBegin('u1', 'x'.repeat(201));
    strictEqual(r.skip, true);
  });

  it('importIdempotencyBegin returns redisKey for new key', async () => {
    const { importIdempotencyBegin } = require('../../../src/services/integration-idempotency');
    const r = await importIdempotencyBegin('u1', 'idem-1');
    ok(r.redisKey);
    ok(r.redisKey.startsWith('ofl:idemp:'));
  });

  it('importIdempotencyBegin replays completed response', async () => {
    const mod = require('../../../src/services/integration-idempotency');
    const client = await redisClient.getRedisClient();
    const key = (await mod.importIdempotencyBegin('u1', 'idem-replay')).redisKey;
    await mod.importIdempotencyComplete(key, { results: [{ ok: true }] });
    const again = await mod.importIdempotencyBegin('u1', 'idem-replay');
    strictEqual(again.replay, true);
    deepStrictEqual(again.body, { results: [{ ok: true }] });
  });

  it('importIdempotencyFail deletes key', async () => {
    const mod = require('../../../src/services/integration-idempotency');
    const { redisKey } = await mod.importIdempotencyBegin('u1', 'idem-fail');
    await mod.importIdempotencyFail(redisKey);
    const again = await mod.importIdempotencyBegin('u1', 'idem-fail');
    ok(again.redisKey);
  });

  it('importIdempotencyFail is no-op when redisKey missing', async () => {
    const { importIdempotencyFail } = require('../../../src/services/integration-idempotency');
    await importIdempotencyFail(null);
    await importIdempotencyFail(undefined);
  });
});
