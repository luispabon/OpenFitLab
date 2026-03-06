const userRepository = require('../repositories/user-repository');
const { runQuery } = require('../repositories/query-helper');
const { placeholders } = require('../utils/transforms');

const defaultDb = require('../db');

/**
 * Export all user data as a JSON-serialisable object.
 * Calls repositories directly (no other services) to avoid circular dependencies.
 * Uses batched IN(...) queries to avoid N+1 patterns.
 *
 * @param {string} userId
 * @param {{ includeStreams?: boolean, db?: object }} opts
 * @returns {Promise<object>}
 */
async function exportUserData(userId, opts = {}) {
  const dbOpts = { db: opts.db ?? defaultDb };
  const includeStreams = opts.includeStreams === true;

  // User profile
  const user = await userRepository.findById(userId, dbOpts);
  if (!user) return null;

  // Identities (exclude profile_data for privacy)
  const identities = await runQuery(
    'SELECT id, provider, provider_user_id, email, created_at FROM user_identities WHERE user_id = ?',
    [userId],
    dbOpts
  );
  const identityRows = Array.isArray(identities) ? identities : [];

  // Events
  const events = await runQuery(
    'SELECT id, start_date, name, end_date, description, is_merge, src_file_type, created_at FROM events WHERE user_id = ?',
    [userId],
    dbOpts
  );
  const eventRows = Array.isArray(events) ? events : [];
  const eventIds = eventRows.map((e) => e.id);

  // Event stats (batched)
  let eventStatRows = [];
  if (eventIds.length > 0) {
    const stats = await runQuery(
      `SELECT event_id, stat_type, value FROM event_stats WHERE event_id IN (${placeholders(eventIds.length)})`,
      eventIds,
      dbOpts
    );
    eventStatRows = Array.isArray(stats) ? stats : [];
  }

  // Activities (batched)
  let activityRows = [];
  if (eventIds.length > 0) {
    const activities = await runQuery(
      `SELECT id, event_id, name, start_date, end_date, type, device_name, created_at FROM activities WHERE event_id IN (${placeholders(eventIds.length)})`,
      eventIds,
      dbOpts
    );
    activityRows = Array.isArray(activities) ? activities : [];
  }
  const activityIds = activityRows.map((a) => a.id);

  // Activity stats (batched)
  let activityStatRows = [];
  if (activityIds.length > 0) {
    const stats = await runQuery(
      `SELECT activity_id, stat_type, value FROM activity_stats WHERE activity_id IN (${placeholders(activityIds.length)})`,
      activityIds,
      dbOpts
    );
    activityStatRows = Array.isArray(stats) ? stats : [];
  }

  // Comparisons
  const comparisons = await runQuery(
    'SELECT id, name, settings, created_at FROM comparisons WHERE user_id = ?',
    [userId],
    dbOpts
  );
  const comparisonRows = Array.isArray(comparisons) ? comparisons : [];
  const comparisonIds = comparisonRows.map((c) => c.id);

  // Comparison events/activities (batched)
  let comparisonEventActivityRows = [];
  if (comparisonIds.length > 0) {
    const links = await runQuery(
      `SELECT comparison_id, event_id, activity_id FROM comparison_event_activities WHERE comparison_id IN (${placeholders(
        comparisonIds.length
      )})`,
      comparisonIds,
      dbOpts
    );
    comparisonEventActivityRows = Array.isArray(links) ? links : [];
  }

  // Streams metadata (batched) — always included; data points only if includeStreams
  let streamRows = [];
  let streamDataPointRows = [];
  if (activityIds.length > 0) {
    const streams = await runQuery(
      `SELECT id, activity_id, event_id, type, created_at FROM streams WHERE activity_id IN (${placeholders(activityIds.length)})`,
      activityIds,
      dbOpts
    );
    streamRows = Array.isArray(streams) ? streams : [];

    if (includeStreams && streamRows.length > 0) {
      const streamIds = streamRows.map((s) => s.id);
      const points = await runQuery(
        `SELECT stream_id, time_ms, value, sequence_index FROM stream_data_points WHERE stream_id IN (${placeholders(streamIds.length)}) ORDER BY stream_id, sequence_index ASC, time_ms ASC`,
        streamIds,
        dbOpts
      );
      streamDataPointRows = Array.isArray(points) ? points : [];
    }
  }

  return {
    user: {
      id: user.id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
    },
    identities: identityRows,
    events: eventRows,
    eventStats: eventStatRows,
    activities: activityRows,
    activityStats: activityStatRows,
    comparisons: comparisonRows,
    comparisonEventActivities: comparisonEventActivityRows,
    streams: streamRows,
    streamDataPoints: includeStreams ? streamDataPointRows : [],
  };
}

/**
 * Delete a user account and all associated data.
 * Cascade delete handles child rows via FK constraints.
 * Sessions are cleared separately since they use a different FK pattern.
 *
 * @param {string} userId
 * @param {{ db?: object }} opts
 * @returns {Promise<boolean>}
 */
async function deleteAccount(userId, opts = {}) {
  const dbOpts = { db: opts.db ?? defaultDb };

  // Clear sessions for this user (sessions store userId in JSON data, not via FK)
  await runQuery("DELETE FROM sessions WHERE data LIKE CONCAT('%', ?, '%')", [userId], dbOpts);

  // Delete user — cascades to identities, events, comparisons, and all child rows
  return userRepository.deleteById(userId, dbOpts);
}

module.exports = { exportUserData, deleteAccount };
