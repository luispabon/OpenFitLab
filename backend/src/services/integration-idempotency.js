const crypto = require('crypto');
const { getRedisClient } = require('../redis-client');

const TTL_COMPLETE_SEC = 86400;
const TTL_PENDING_SEC = 180;

function makeKey(userId, rawKey) {
  const hash = crypto.createHash('sha256').update(`${userId}:${rawKey}`).digest('hex');
  return `ofl:idemp:${hash}`;
}

/**
 * @returns {Promise<{ skip?: true, replay?: true, body?: unknown, conflict?: true, redisKey?: string }>}
 */
async function importIdempotencyBegin(userId, rawKey) {
  if (!rawKey || typeof rawKey !== 'string' || rawKey.length > 200) {
    return { skip: true };
  }
  const client = await getRedisClient();
  const key = makeKey(userId, rawKey);
  const existing = await client.get(key);
  if (existing) {
    try {
      const o = JSON.parse(existing);
      if (o.status === 'complete') return { replay: true, body: o.body };
      if (o.status === 'pending') return { conflict: true };
    } catch {
      /* treat as missing */
    }
  }
  const nx = await client.set(key, JSON.stringify({ status: 'pending' }), {
    EX: TTL_PENDING_SEC,
    NX: true,
  });
  if (!nx) {
    const again = await client.get(key);
    try {
      const o = JSON.parse(again);
      if (o.status === 'complete') return { replay: true, body: o.body };
    } catch {
      /* */
    }
    return { conflict: true };
  }
  return { redisKey: key };
}

async function importIdempotencyComplete(redisKey, body) {
  const client = await getRedisClient();
  await client.set(redisKey, JSON.stringify({ status: 'complete', body }), {
    EX: TTL_COMPLETE_SEC,
  });
}

async function importIdempotencyFail(redisKey) {
  if (!redisKey) return;
  try {
    const client = await getRedisClient();
    await client.del(redisKey);
  } catch {
    /* ignore */
  }
}

module.exports = {
  importIdempotencyBegin,
  importIdempotencyComplete,
  importIdempotencyFail,
};
