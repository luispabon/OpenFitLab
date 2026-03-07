const userRepository = require('../repositories/user-repository');
const folderRepository = require('../repositories/folder-repository');
const eventRepository = require('../repositories/event-repository');
const activityRepository = require('../repositories/activity-repository');
const comparisonRepository = require('../repositories/comparison-repository');
const streamRepository = require('../repositories/stream-repository');

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
  const dbOpts = { db: opts.db ?? defaultDb, userId };
  const includeStreams = opts.includeStreams === true;

  // User profile
  const user = await userRepository.findById(userId, dbOpts);
  if (!user) return null;

  // Identities (exclude profile_data for privacy)
  const identityRows = await userRepository.findIdentitiesByUserId(userId, dbOpts);

  // Folders
  const folderRows = await folderRepository.listAll(userId, dbOpts);

  // Events (include folder_id)
  const eventRows = await eventRepository.findAllByUserId(userId, dbOpts);
  const eventIds = eventRows.map((e) => e.id);

  // Event stats (batched)
  const eventStatRows =
    eventIds.length > 0 ? await eventRepository.getStatsByEventIds(eventIds, dbOpts) : [];

  // Activities (batched)
  const activityRows =
    eventIds.length > 0 ? await activityRepository.findManyByEventIds(eventIds, dbOpts) : [];
  const activityIds = activityRows.map((a) => a.id);

  // Activity stats (batched)
  const activityStatRows =
    activityIds.length > 0
      ? await activityRepository.getStatsByActivityIds(activityIds, dbOpts)
      : [];

  // Comparisons (include folder_id)
  const comparisonRows = await comparisonRepository.findAllByUserId(userId, dbOpts);
  const comparisonIds = comparisonRows.map((c) => c.id);

  // Comparison events/activities (batched)
  const comparisonEventActivityRows =
    comparisonIds.length > 0
      ? await comparisonRepository.findEventActivitiesByComparisonIds(comparisonIds, dbOpts)
      : [];

  // Streams metadata (batched) — always included; data points only if includeStreams
  let streamRows = [];
  let streamDataPointRows = [];
  if (activityIds.length > 0) {
    streamRows = await streamRepository.findAllByActivityIds(activityIds, dbOpts);
    if (includeStreams && streamRows.length > 0) {
      const streamIds = streamRows.map((s) => s.id);
      streamDataPointRows = await streamRepository.findDataPointsByStreamIdsOrdered(
        streamIds,
        dbOpts
      );
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
    folders: folderRows,
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
 * Sessions are stored in Valkey (not in DB); the account route destroys the current
 * session after delete. Other sessions for this user expire naturally.
 *
 * @param {string} userId
 * @param {{ db?: object }} opts
 * @returns {Promise<boolean>}
 */
async function deleteAccount(userId, opts = {}) {
  const dbOpts = { db: opts.db ?? defaultDb };

  // Delete user — cascades to identities, events, comparisons, and all child rows
  return userRepository.deleteById(userId, dbOpts);
}

module.exports = { exportUserData, deleteAccount };
