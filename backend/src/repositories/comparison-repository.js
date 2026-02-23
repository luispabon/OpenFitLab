const { runQuery } = require('./query-helper');
const { placeholders } = require('../utils/transforms');

async function create(id, name, eventIds, settings, opts = {}) {
  await runQuery(
    'INSERT INTO comparisons (id, name, settings) VALUES (?, ?, ?)',
    [id, name, settings ? JSON.stringify(settings) : null],
    opts
  );
  for (const eventId of eventIds) {
    await runQuery(
      'INSERT INTO comparison_events (comparison_id, event_id) VALUES (?, ?)',
      [id, eventId],
      opts
    );
  }
}

async function findAll(limit, opts = {}) {
  const rows = await runQuery(
    'SELECT id, name, settings, created_at FROM comparisons ORDER BY created_at DESC LIMIT ?',
    [limit],
    opts
  );
  const comparisons = Array.isArray(rows) ? rows : [];
  if (comparisons.length === 0) return [];

  const ids = comparisons.map((r) => r.id);
  const linkRows = await runQuery(
    `SELECT comparison_id, event_id FROM comparison_events WHERE comparison_id IN (${placeholders(ids.length)})`,
    ids,
    opts
  );
  const linkArr = Array.isArray(linkRows) ? linkRows : [];

  const eventIdsByComparison = {};
  for (const link of linkArr) {
    if (!eventIdsByComparison[link.comparison_id]) {
      eventIdsByComparison[link.comparison_id] = [];
    }
    eventIdsByComparison[link.comparison_id].push(link.event_id);
  }

  return comparisons.map((row) => ({
    ...row,
    event_ids: eventIdsByComparison[row.id] || [],
  }));
}

async function findById(id, opts = {}) {
  const rows = await runQuery(
    'SELECT id, name, settings, created_at FROM comparisons WHERE id = ?',
    [id],
    opts
  );
  const row = Array.isArray(rows) ? (rows[0] ?? null) : null;
  if (!row) return null;

  const linkRows = await runQuery(
    'SELECT event_id FROM comparison_events WHERE comparison_id = ?',
    [id],
    opts
  );
  row.event_ids = Array.isArray(linkRows) ? linkRows.map((r) => r.event_id) : [];
  return row;
}

/**
 * Find comparisons linked to any of the given event IDs.
 * Returns lightweight rows (id, name, created_at) without full event lists.
 */
async function findByEventIds(eventIds, opts = {}) {
  if (!eventIds.length) return [];
  const rows = await runQuery(
    `SELECT DISTINCT c.id, c.name, c.created_at
     FROM comparisons c
     JOIN comparison_events ce ON ce.comparison_id = c.id
     WHERE ce.event_id IN (${placeholders(eventIds.length)})`,
    eventIds,
    opts
  );
  return Array.isArray(rows) ? rows : [];
}

async function existsById(id, opts = {}) {
  const rows = await runQuery('SELECT id FROM comparisons WHERE id = ?', [id], opts);
  return Array.isArray(rows) ? rows.length > 0 : false;
}

async function deleteById(id, opts = {}) {
  const result = await runQuery('DELETE FROM comparisons WHERE id = ?', [id], opts);
  return result && result.affectedRows === 1;
}

async function deleteByIds(ids, opts = {}) {
  if (!ids.length) return;
  await runQuery(`DELETE FROM comparisons WHERE id IN (${placeholders(ids.length)})`, ids, opts);
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
