const { randomUUID } = require('crypto');
const defaultDb = require('../db');
const comparisonRepository = require('../repositories/comparison-repository');
const activityRepository = require('../repositories/activity-repository');
const { parseJSONField } = require('../utils/transforms');

/**
 * @param {string} name
 * @param {string[]} activityIds
 * @param {object | null} settings
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<object>} { id, name, eventIds, activityIds, settings, createdAt }
 */
async function createComparison(name, activityIds, settings, opts = {}) {
  if (!opts.userId) throw new Error('createComparison requires opts.userId');
  const db = opts.db ?? defaultDb;
  const id = randomUUID();
  const trimmedName = name.trim();
  let eventIds = [];
  let activityIdsOut = [];

  await db.transaction(async (conn) => {
    const txOpts = { ...opts, db, conn };
    // Verify all activities (and their parent events) belong to the user
    const activities = await activityRepository.findManyByIds(activityIds, txOpts);
    const ownedActivityIds = new Set(activities.map((a) => a.id));
    if (ownedActivityIds.size !== activityIds.length) {
      const err = new Error('One or more activities not found');
      err.statusCode = 404;
      throw err;
    }

    const activityRows = activities.map((a) => ({
      eventId: a.event_id,
      activityId: a.id,
    }));

    eventIds = activityRows.map((row) => row.eventId);
    activityIdsOut = activityRows.map((row) => row.activityId);

    await comparisonRepository.create(id, trimmedName, activityRows, settings, txOpts);
  });

  return {
    id,
    name: trimmedName,
    eventIds,
    activityIds: activityIdsOut,
    settings: settings || null,
    createdAt: Date.now(),
  };
}

/**
 * @param {number} limit
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<Array<object>>}
 */
async function getComparisons(limit = 100, opts = {}) {
  if (!opts.userId) throw new Error('getComparisons requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const rows = await comparisonRepository.findAll(limit, repoOpts);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    eventIds: row.event_ids,
    activityIds: row.activity_ids,
    settings: parseJSONField(row.settings, null),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
  }));
}

/**
 * @param {string} id
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<object | null>}
 */
async function getComparisonById(id, opts = {}) {
  if (!opts.userId) throw new Error('getComparisonById requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const row = await comparisonRepository.findById(id, repoOpts);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    eventIds: row.event_ids,
    activityIds: row.activity_ids,
    settings: parseJSONField(row.settings, null),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
  };
}

/**
 * Find comparisons linked to any of the given event IDs.
 * @param {string[]} eventIds
 * @param {{ db?: object }} [opts]
 * @returns {Promise<Array<{ id: string, name: string, createdAt?: number }>>}
 */
async function getComparisonsByEventIds(eventIds, opts = {}) {
  if (!opts.userId) throw new Error('getComparisonsByEventIds requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const rows = await comparisonRepository.findByEventIds(eventIds, repoOpts);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
  }));
}

/**
 * @param {string} id
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
async function deleteComparisonById(id, opts = {}) {
  if (!opts.userId) throw new Error('deleteComparisonById requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const existing = await comparisonRepository.existsById(id, repoOpts);
  if (!existing) return false;
  await comparisonRepository.deleteById(id, repoOpts);
  return true;
}

module.exports = {
  createComparison,
  getComparisons,
  getComparisonById,
  getComparisonsByEventIds,
  deleteComparisonById,
};
