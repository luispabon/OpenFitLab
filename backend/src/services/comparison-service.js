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

    await comparisonRepository.create(id, trimmedName, activityRows, settings, {
      ...txOpts,
      folderId: opts.folderId ?? null,
    });
  });

  return {
    id,
    name: trimmedName,
    eventIds,
    activityIds: activityIdsOut,
    settings: settings || null,
    folderId: opts.folderId ?? null,
    createdAt: Date.now(),
  };
}

/**
 * @param {number} limit
 * @param {{ db?: object, folderId?: string | null }} [opts] - Optional; folderId filters by folder or surfaced
 * @returns {Promise<Array<object>>}
 */
async function getComparisons(limit = 100, opts = {}) {
  if (!opts.userId) throw new Error('getComparisons requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const folderId =
    opts.folderId != null && opts.folderId !== '' && opts.folderId !== 'all' ? opts.folderId : null;
  const rows = folderId
    ? await comparisonRepository.findAllForFolder(folderId, limit, repoOpts)
    : await comparisonRepository.findAll(limit, repoOpts);

  const ids = rows.map((r) => r.id);
  const folderIdsByComparison =
    ids.length > 0 ? await comparisonRepository.getEventFolderIdsForComparisons(ids, repoOpts) : {};

  return rows.map((row) => {
    const eventFolderIds = folderIdsByComparison[row.id];
    const mixed = eventFolderIds ? eventFolderIds.size > 1 : false;
    const surfaced = Boolean(folderId && row.folder_id !== folderId);
    const referenceActivityStartDate =
      row.reference_activity_start_date != null
        ? Number(row.reference_activity_start_date)
        : undefined;
    return {
      id: row.id,
      name: row.name,
      eventIds: row.event_ids,
      activityIds: row.activity_ids,
      settings: parseJSONField(row.settings, null),
      folderId: row.folder_id ?? null,
      mixed,
      surfaced,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
      referenceActivityStartDate,
    };
  });
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
  const folderIdsByComparison = await comparisonRepository.getEventFolderIdsForComparisons(
    [id],
    repoOpts
  );
  const eventFolderIds = folderIdsByComparison[id];
  const mixed = eventFolderIds ? eventFolderIds.size > 1 : false;
  const referenceActivityStartDate =
    row.reference_activity_start_date != null
      ? Number(row.reference_activity_start_date)
      : undefined;
  return {
    id: row.id,
    name: row.name,
    eventIds: row.event_ids,
    activityIds: row.activity_ids,
    settings: parseJSONField(row.settings, null),
    folderId: row.folder_id ?? null,
    mixed,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
    referenceActivityStartDate,
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

/**
 * Update a comparison's folder assignment.
 * @param {string} id
 * @param {string|null} folderId
 * @param {{ db?: object }} [opts]
 * @returns {Promise<boolean>} true if updated, false if not found
 */
async function updateComparisonFolder(id, folderId, opts = {}) {
  if (!opts.userId) throw new Error('updateComparisonFolder requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };

  const existing = await comparisonRepository.existsById(id, repoOpts);
  if (!existing) return false;

  const newFolderId = folderId != null && folderId !== '' ? folderId : null;
  return await comparisonRepository.updateFolderId(id, newFolderId, repoOpts);
}

/**
 * Update a comparison's settings.
 * @param {string} id
 * @param {object} settings
 * @param {{ db?: object }} [opts]
 * @returns {Promise<object | null>} updated settings, or null if not found
 */
async function updateComparisonSettings(id, settings, opts = {}) {
  if (!opts.userId) throw new Error('updateComparisonSettings requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };

  const updated = await comparisonRepository.updateSettings(id, settings, repoOpts);
  if (!updated) return null;
  return settings;
}

/**
 * Update a comparison's name.
 * @param {string} id
 * @param {string} name
 * @param {{ db?: object }} [opts]
 * @returns {Promise<boolean>} true if updated, false if not found
 */
async function updateComparisonName(id, name, opts = {}) {
  if (!opts.userId) throw new Error('updateComparisonName requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };

  const existing = await comparisonRepository.existsById(id, repoOpts);
  if (!existing) return false;

  const trimmedName = name.trim();
  return await comparisonRepository.updateName(id, trimmedName, repoOpts);
}

module.exports = {
  createComparison,
  getComparisons,
  getComparisonById,
  getComparisonsByEventIds,
  deleteComparisonById,
  updateComparisonFolder,
  updateComparisonSettings,
  updateComparisonName,
};
