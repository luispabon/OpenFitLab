/**
 * Per-user session tracking in Valkey, used to revoke all of a user's sessions
 * on account deletion. Not a `services/*` module so both services/auth-service.js
 * and services/account-service.js can depend on it without creating a
 * service-to-service dependency (see .cursor/rules/backend-architecture.mdc).
 */

const redisClient = require('./redis-client');

/** Must match the `prefix` passed to `RedisStore` in middleware/session.js. */
const SESSION_KEY_PREFIX = 'ofl:sess:';

function userSessionsKey(userId) {
  return `ofl:user-sessions:${userId}`;
}

/**
 * Record that `sessionId` belongs to `userId`.
 * The tracking set deliberately has no TTL: connect-redis slides each session's TTL on every
 * request (touch), so an active session can outlive any fixed expiry set here at login.
 * Stale IDs are harmless (deleting a missing key is a no-op) and are cleared on revoke.
 * @param {string} userId
 * @param {string} sessionId
 * @param {{ client?: object }} [opts]
 */
async function trackSession(userId, sessionId, opts = {}) {
  const client = opts.client ?? (await redisClient.getRedisClient());
  await client.sAdd(userSessionsKey(userId), sessionId);
}

/**
 * Delete every Valkey session tracked for `userId`, plus the tracking set itself.
 * @param {string} userId
 * @param {{ client?: object }} [opts]
 */
async function revokeUserSessions(userId, opts = {}) {
  const client = opts.client ?? (await redisClient.getRedisClient());
  const key = userSessionsKey(userId);
  const sessionIds = await client.sMembers(key);
  if (sessionIds.length > 0) {
    await client.del(sessionIds.map((sid) => `${SESSION_KEY_PREFIX}${sid}`));
  }
  await client.del(key);
}

module.exports = { trackSession, revokeUserSessions, userSessionsKey, SESSION_KEY_PREFIX };
