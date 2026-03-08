const { runQuery } = require('./query-helper');
const { placeholders } = require('../utils/transforms');

async function create(id, name, activityRows, settings, opts = {}) {
  if (!opts.userId) throw new Error('create comparison requires opts.userId');
  const folderId = opts.folderId != null && opts.folderId !== '' ? opts.folderId : null;
  await runQuery(
    'INSERT INTO comparisons (id, user_id, folder_id, name, settings) VALUES (?, ?, ?, ?, ?)',
    [id, opts.userId, folderId, name, settings ? JSON.stringify(settings) : null],
    opts
  );
  if (activityRows.length > 0) {
    const placeholdersList = activityRows.map(() => '(?, ?, ?)').join(', ');
    const values = activityRows.flatMap((row) => [id, row.eventId, row.activityId]);
    await runQuery(
      `INSERT INTO comparison_event_activities (comparison_id, event_id, activity_id) VALUES ${placeholdersList}`,
      values,
      opts
    );
  }
}

async function findAllByUserId(userId, opts = {}) {
  const rows = await runQuery(
    'SELECT id, folder_id, name, settings, created_at FROM comparisons WHERE user_id = ?',
    [userId],
    opts
  );
  return Array.isArray(rows) ? rows : [];
}

async function findEventActivitiesByComparisonIds(comparisonIds, opts = {}) {
  if (!comparisonIds.length) return [];
  const rows = await runQuery(
    `SELECT comparison_id, event_id, activity_id FROM comparison_event_activities WHERE comparison_id IN (${placeholders(
      comparisonIds.length
    )})`,
    comparisonIds,
    opts
  );
  return Array.isArray(rows) ? rows : [];
}

async function findAll(limit, opts = {}) {
  if (!opts.userId) throw new Error('findAll comparisons requires opts.userId');
  const rows = await runQuery(
    'SELECT id, folder_id, name, settings, created_at FROM comparisons WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
    [opts.userId, limit],
    opts
  );
  const comparisons = Array.isArray(rows) ? rows : [];
  if (comparisons.length === 0) return [];

  const ids = comparisons.map((r) => r.id);
  const linkRows = await runQuery(
    `SELECT comparison_id, event_id, activity_id FROM comparison_event_activities WHERE comparison_id IN (${placeholders(
      ids.length
    )})`,
    ids,
    opts
  );
  const linkArr = Array.isArray(linkRows) ? linkRows : [];

  const eventIdsByComparison = {};
  const activityIdsByComparison = {};
  for (const link of linkArr) {
    if (!eventIdsByComparison[link.comparison_id]) {
      eventIdsByComparison[link.comparison_id] = [];
    }
    eventIdsByComparison[link.comparison_id].push(link.event_id);
    if (!activityIdsByComparison[link.comparison_id]) {
      activityIdsByComparison[link.comparison_id] = [];
    }
    activityIdsByComparison[link.comparison_id].push(link.activity_id);
  }

  return comparisons.map((row) => ({
    ...row,
    event_ids: eventIdsByComparison[row.id] || [],
    activity_ids: activityIdsByComparison[row.id] || [],
  }));
}

/**
 * Find comparisons for folder view: folder_id = folderId OR comparison references an event in folderId.
 */
async function findAllForFolder(folderId, limit, opts = {}) {
  if (!opts.userId) throw new Error('findAllForFolder requires opts.userId');
  const rows = await runQuery(
    `SELECT c.id, c.folder_id, c.name, c.settings, c.created_at
     FROM comparisons c
     WHERE c.user_id = ?
       AND (
         c.folder_id = ?
         OR c.id IN (
           SELECT cea.comparison_id FROM comparison_event_activities cea
           INNER JOIN events e ON e.id = cea.event_id AND e.user_id = ?
           WHERE e.folder_id = ?
         )
       )
     ORDER BY c.created_at DESC
     LIMIT ?`,
    [opts.userId, folderId, opts.userId, folderId, limit],
    opts
  );
  const comparisons = Array.isArray(rows) ? rows : [];
  if (comparisons.length === 0) return [];

  const ids = comparisons.map((r) => r.id);
  const linkRows = await runQuery(
    `SELECT comparison_id, event_id, activity_id FROM comparison_event_activities WHERE comparison_id IN (${placeholders(
      ids.length
    )})`,
    ids,
    opts
  );
  const linkArr = Array.isArray(linkRows) ? linkRows : [];

  const eventIdsByComparison = {};
  const activityIdsByComparison = {};
  for (const link of linkArr) {
    if (!eventIdsByComparison[link.comparison_id]) {
      eventIdsByComparison[link.comparison_id] = [];
    }
    eventIdsByComparison[link.comparison_id].push(link.event_id);
    if (!activityIdsByComparison[link.comparison_id]) {
      activityIdsByComparison[link.comparison_id] = [];
    }
    activityIdsByComparison[link.comparison_id].push(link.activity_id);
  }

  return comparisons.map((row) => ({
    ...row,
    event_ids: eventIdsByComparison[row.id] || [],
    activity_ids: activityIdsByComparison[row.id] || [],
  }));
}

async function findById(id, opts = {}) {
  if (!opts.userId) throw new Error('findById comparison requires opts.userId');
  const rows = await runQuery(
    'SELECT id, folder_id, name, settings, created_at FROM comparisons WHERE id = ? AND user_id = ?',
    [id, opts.userId],
    opts
  );
  const row = Array.isArray(rows) ? (rows[0] ?? null) : null;
  if (!row) return null;

  const linkRows = await runQuery(
    'SELECT event_id, activity_id FROM comparison_event_activities WHERE comparison_id = ?',
    [id],
    opts
  );
  if (Array.isArray(linkRows)) {
    row.event_ids = linkRows.map((r) => r.event_id);
    row.activity_ids = linkRows.map((r) => r.activity_id);
  } else {
    row.event_ids = [];
    row.activity_ids = [];
  }
  return row;
}

/**
 * Find comparisons linked to any of the given event IDs.
 * Returns lightweight rows (id, name, created_at) without full event lists.
 */
async function findByEventIds(eventIds, opts = {}) {
  if (!eventIds.length) return [];
  if (!opts.userId) throw new Error('findByEventIds comparisons requires opts.userId');
  const rows = await runQuery(
    `SELECT DISTINCT c.id, c.name, c.created_at
     FROM comparisons c
     JOIN comparison_event_activities cea ON cea.comparison_id = c.id
     WHERE cea.event_id IN (${placeholders(eventIds.length)}) AND c.user_id = ?`,
    [...eventIds, opts.userId],
    opts
  );
  return Array.isArray(rows) ? rows : [];
}

async function existsById(id, opts = {}) {
  if (!opts.userId) throw new Error('existsById comparison requires opts.userId');
  const rows = await runQuery(
    'SELECT id FROM comparisons WHERE id = ? AND user_id = ?',
    [id, opts.userId],
    opts
  );
  return Array.isArray(rows) ? rows.length > 0 : false;
}

async function deleteById(id, opts = {}) {
  if (!opts.userId) throw new Error('deleteById comparison requires opts.userId');
  const result = await runQuery(
    'DELETE FROM comparisons WHERE id = ? AND user_id = ?',
    [id, opts.userId],
    opts
  );
  return result && result.affectedRows === 1;
}

async function deleteByIds(ids, opts = {}) {
  if (!ids.length) return;
  if (!opts.userId) throw new Error('deleteByIds comparison requires opts.userId');
  await runQuery(
    `DELETE FROM comparisons WHERE id IN (${placeholders(ids.length)}) AND user_id = ?`,
    [...ids, opts.userId],
    opts
  );
}

async function getEventFolderIdsForComparisons(comparisonIds, opts = {}) {
  if (!comparisonIds.length) return {};
  if (!opts.userId) throw new Error('getEventFolderIdsForComparisons requires opts.userId');
  const linkRows = await runQuery(
    `SELECT cea.comparison_id, e.folder_id
     FROM comparison_event_activities cea
     INNER JOIN events e ON e.id = cea.event_id AND e.user_id = ?
     WHERE cea.comparison_id IN (${placeholders(comparisonIds.length)})`,
    [opts.userId, ...comparisonIds],
    opts
  );
  const arr = Array.isArray(linkRows) ? linkRows : [];
  const byComparison = {};
  for (const r of arr) {
    if (!byComparison[r.comparison_id]) byComparison[r.comparison_id] = new Set();
    byComparison[r.comparison_id].add(r.folder_id);
  }
  return byComparison;
}

async function updateFolderId(id, folderId, opts = {}) {
  if (!opts.userId) throw new Error('updateFolderId comparison requires opts.userId');
  const newFolderId = folderId != null && folderId !== '' ? folderId : null;
  const result = await runQuery(
    'UPDATE comparisons SET folder_id = ? WHERE id = ? AND user_id = ?',
    [newFolderId, id, opts.userId],
    opts
  );
  return result && result.affectedRows === 1;
}

module.exports = {
  create,
  findAll,
  findAllForFolder,
  findAllByUserId,
  findEventActivitiesByComparisonIds,
  findById,
  findByEventIds,
  existsById,
  deleteById,
  deleteByIds,
  getEventFolderIdsForComparisons,
  updateFolderId,
};
