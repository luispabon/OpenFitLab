const userRepository = require('../repositories/user-repository');
const folderRepository = require('../repositories/folder-repository');
const eventRepository = require('../repositories/event-repository');
const activityRepository = require('../repositories/activity-repository');
const comparisonRepository = require('../repositories/comparison-repository');
const streamRepository = require('../repositories/stream-repository');
const { parseJSONField } = require('../utils/transforms');

const defaultDb = require('../db');

/**
 * Export all user data as a JSON-serialisable object.
 * Calls repositories directly (no other services) to avoid circular dependencies.
 * Uses batched IN(...) queries and Promise.all to minimise latency.
 *
 * @param {string} userId
 * @param {{ includeStreams?: boolean, db?: object }} opts
 * @returns {Promise<object|null>}
 */
async function exportUserData(userId, opts = {}) {
  const dbOpts = { db: opts.db ?? defaultDb, userId };
  const includeStreams = opts.includeStreams === true;

  // Level 1: user profile — needed to short-circuit if user not found
  const user = await userRepository.findById(userId, dbOpts);
  if (!user) return null;

  // Level 2: all queries that depend only on userId (independent of each other)
  const [identityRows, folderRows, eventRows, comparisonRows] = await Promise.all([
    userRepository.findIdentitiesByUserId(userId, dbOpts),
    folderRepository.listAll(userId, dbOpts),
    eventRepository.findAllByUserId(userId, dbOpts),
    comparisonRepository.findAllByUserId(userId, dbOpts),
  ]);

  const eventIds = eventRows.map((e) => e.id);
  const comparisonIds = comparisonRows.map((c) => c.id);

  // Level 3: queries that depend on eventIds or comparisonIds
  const [eventStatRows, activityRows, comparisonEventActivityRows] = await Promise.all([
    eventIds.length > 0
      ? eventRepository.getStatsByEventIds(eventIds, dbOpts)
      : Promise.resolve([]),
    eventIds.length > 0
      ? activityRepository.findManyByEventIds(eventIds, dbOpts)
      : Promise.resolve([]),
    comparisonIds.length > 0
      ? comparisonRepository.findEventActivitiesByComparisonIds(comparisonIds, dbOpts)
      : Promise.resolve([]),
  ]);

  const activityIds = activityRows.map((a) => a.id);

  // Level 4: queries that depend on activityIds
  const [activityStatRows, streamRows] = await Promise.all([
    activityIds.length > 0
      ? activityRepository.getStatsByActivityIds(activityIds, dbOpts)
      : Promise.resolve([]),
    activityIds.length > 0
      ? streamRepository.findAllByActivityIds(activityIds, dbOpts)
      : Promise.resolve([]),
  ]);

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
    streams: includeStreams
      ? streamRows.map((row) => ({ ...row, data: parseJSONField(row.data, []) }))
      : streamRows.map(({ data: _data, ...rest }) => rest),
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
