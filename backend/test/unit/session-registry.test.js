const { describe, it, beforeEach, afterEach } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const { mock } = require('node:test');
const redisClient = require('../../src/redis-client');

describe('session-registry', () => {
  let getRedisClientMock;
  let sets;
  let expirations;
  let delCalls;

  beforeEach(() => {
    sets = new Map();
    expirations = [];
    delCalls = [];
    getRedisClientMock = mock.method(redisClient, 'getRedisClient', async () => ({
      async sAdd(key, member) {
        if (!sets.has(key)) sets.set(key, new Set());
        sets.get(key).add(member);
      },
      async sMembers(key) {
        return Array.from(sets.get(key) ?? []);
      },
      async expire(key, seconds) {
        expirations.push({ key, seconds });
      },
      async del(keys) {
        const list = Array.isArray(keys) ? keys : [keys];
        delCalls.push(list);
        for (const k of list) sets.delete(k);
      },
    }));
  });

  afterEach(() => {
    getRedisClientMock.mock.restore();
  });

  it('userSessionsKey namespaces by user id', () => {
    const { userSessionsKey } = require('../../src/session-registry');
    strictEqual(userSessionsKey('u1'), 'ofl:user-sessions:u1');
  });

  it('SESSION_KEY_PREFIX matches the connect-redis prefix used in middleware/session.js', () => {
    const { SESSION_KEY_PREFIX } = require('../../src/session-registry');
    strictEqual(SESSION_KEY_PREFIX, 'ofl:sess:');
  });

  it('trackSession adds the session id to the user set without a TTL', async () => {
    const { trackSession, userSessionsKey } = require('../../src/session-registry');
    await trackSession('u1', 'sid-1');
    deepStrictEqual(Array.from(sets.get(userSessionsKey('u1'))), ['sid-1']);
    // Sessions slide on touch; a TTL on the set could expire before a live session does.
    strictEqual(expirations.length, 0);
  });

  it('trackSession accumulates multiple sessions for the same user', async () => {
    const { trackSession, userSessionsKey } = require('../../src/session-registry');
    await trackSession('u1', 'sid-1');
    await trackSession('u1', 'sid-2');
    deepStrictEqual(
      new Set(sets.get(userSessionsKey('u1'))),
      new Set(['sid-1', 'sid-2'])
    );
  });

  it('revokeUserSessions deletes every tracked session key and the set itself', async () => {
    const { trackSession, revokeUserSessions, userSessionsKey } = require('../../src/session-registry');
    await trackSession('u1', 'sid-1');
    await trackSession('u1', 'sid-2');
    await revokeUserSessions('u1');
    deepStrictEqual(new Set(delCalls[0]), new Set(['ofl:sess:sid-1', 'ofl:sess:sid-2']));
    deepStrictEqual(delCalls[1], [userSessionsKey('u1')]);
    strictEqual(sets.has(userSessionsKey('u1')), false);
  });

  it('revokeUserSessions is a no-op (only deletes the empty set key) when nothing is tracked', async () => {
    const { revokeUserSessions, userSessionsKey } = require('../../src/session-registry');
    await revokeUserSessions('ghost');
    strictEqual(delCalls.length, 1);
    deepStrictEqual(delCalls[0], [userSessionsKey('ghost')]);
  });

  it('trackSession uses the injected client when provided', async () => {
    const { trackSession } = require('../../src/session-registry');
    const calls = [];
    const client = {
      async sAdd(key, member) {
        calls.push(['sAdd', key, member]);
      },
      async expire(key, seconds) {
        calls.push(['expire', key, seconds]);
      },
    };
    await trackSession('u2', 'sid-9', { client });
    strictEqual(getRedisClientMock.mock.callCount(), 0);
    strictEqual(calls[0][0], 'sAdd');
  });
});
