const { runQuery } = require('./query-helper');
const { placeholders } = require('../utils/transforms');

async function create(id, name, activityRows, settings, opts = {}) {
  if (!opts.userId) throw new Error('create comparison requires opts.userId');
  await runQuery(
    'INSERT INTO comparisons (id, user_id, name, settings) VALUES (?, ?, ?, ?)',
    [id, opts.userId, name, settings ? JSON.stringify(settings) : null],
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

async function findAll(limit, opts = {}) {
  if (!opts.userId) throw new Error('findAll comparisons requires opts.userId');
  const rows = await runQuery(
    'SELECT id, name, settings, created_at FROM comparisons WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
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

async function findById(id, opts = {}) {
  if (!opts.userId) throw new Error('findById comparison requires opts.userId');
  const rows = await runQuery(
    'SELECT id, name, settings, created_at FROM comparisons WHERE id = ? AND user_id = ?',
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

module.exports = {
  create,
  findAll,
  findById,
  findByEventIds,
  existsById,
  deleteById,
  deleteByIds,
};
