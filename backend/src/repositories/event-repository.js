const { runQuery } = require('./query-helper');
const { placeholders } = require('../utils/transforms');

const EVENT_COLUMNS = 'id, start_date, name, end_date, description, is_merge, src_file_type';

async function insertEvent(row, opts = {}) {
  const sql = `INSERT INTO events (id, start_date, name, end_date, description, is_merge, src_file_type) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  await runQuery(
    sql,
    [
      row.id,
      row.start_date,
      row.name,
      row.end_date,
      row.description,
      row.is_merge,
      row.src_file_type,
    ],
    opts
  );
}

async function insertEventStats(eventId, stats, opts = {}) {
  for (const [statType, value] of Object.entries(stats)) {
    if (value === undefined || value === null) continue;
    await runQuery(
      'INSERT INTO event_stats (event_id, stat_type, value) VALUES (?, ?, ?)',
      [eventId, statType, JSON.stringify(value)],
      opts
    );
  }
}

async function findById(id, opts = {}) {
  const rows = await runQuery(`SELECT ${EVENT_COLUMNS} FROM events WHERE id = ?`, [id], opts);
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function getDateRange(id, opts = {}) {
  const rows = await runQuery('SELECT start_date, end_date FROM events WHERE id = ?', [id], opts);
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function findMany(filters, opts = {}) {
  let sql = `SELECT ${EVENT_COLUMNS} FROM events WHERE 1=1`;
  const params = [];
  if (filters.startDate != null) {
    sql += ' AND start_date >= ?';
    params.push(Number(filters.startDate));
  }
  if (filters.endDate != null) {
    sql += ' AND start_date <= ?';
    params.push(Number(filters.endDate));
  }
  sql += ' ORDER BY start_date DESC LIMIT ?';
  params.push(Math.min(Number(filters.limit) || 50, 200));
  const rows = await runQuery(sql, params, opts);
  return Array.isArray(rows) ? rows : [];
}

async function findManyByIds(ids, opts = {}) {
  if (!ids.length) return [];
  const sql = `SELECT ${EVENT_COLUMNS} FROM events WHERE id IN (${placeholders(ids.length)})`;
  const rows = await runQuery(sql, ids, opts);
  return Array.isArray(rows) ? rows : [];
}

async function findOverlapping(excludeId, startDate, endDate, limit, opts = {}) {
  const sql = `
    SELECT ${EVENT_COLUMNS}
    FROM events
    WHERE id != ?
      AND start_date <= ?
      AND COALESCE(end_date, start_date) >= ?
    ORDER BY start_date DESC
    LIMIT ?
  `;
  const rows = await runQuery(sql, [excludeId, endDate, startDate, limit], opts);
  return Array.isArray(rows) ? rows : [];
}

async function getStatsByEventIds(eventIds, opts = {}) {
  if (!eventIds.length) return [];
  const sql = `SELECT event_id, stat_type, value FROM event_stats WHERE event_id IN (${placeholders(eventIds.length)})`;
  const rows = await runQuery(sql, eventIds, opts);
  return Array.isArray(rows) ? rows : [];
}

async function getStatsByEventId(eventId, opts = {}) {
  const rows = await runQuery(
    'SELECT stat_type, value FROM event_stats WHERE event_id = ?',
    [eventId],
    opts
  );
  return Array.isArray(rows) ? rows : [];
}

async function upsertEventStat(eventId, statType, value, opts = {}) {
  await runQuery(
    'INSERT INTO event_stats (event_id, stat_type, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
    [eventId, statType, JSON.stringify(value)],
    opts
  );
}

async function deleteById(id, opts = {}) {
  const result = await runQuery('DELETE FROM events WHERE id = ?', [id], opts);
  return result && result.affectedRows === 1;
}

module.exports = {
  insertEvent,
  insertEventStats,
  findById,
  getDateRange,
  findMany,
  findManyByIds,
  findOverlapping,
  getStatsByEventIds,
  getStatsByEventId,
  upsertEventStat,
  deleteById,
};
