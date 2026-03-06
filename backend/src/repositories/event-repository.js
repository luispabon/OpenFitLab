const { runQuery } = require('./query-helper');
const { placeholders } = require('../utils/transforms');

const EVENT_COLUMNS =
  'id, start_date, name, end_date, description, is_merge, src_file_type, start_timezone, end_timezone';

async function insertEvent(row, opts = {}) {
  if (!opts.userId) throw new Error('insertEvent requires opts.userId');
  const sql = `INSERT INTO events (id, user_id, start_date, name, end_date, description, is_merge, src_file_type, start_timezone, end_timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  await runQuery(
    sql,
    [
      row.id,
      opts.userId,
      row.start_date,
      row.name,
      row.end_date,
      row.description,
      row.is_merge,
      row.src_file_type,
      row.start_timezone,
      row.end_timezone,
    ],
    opts
  );
}

async function insertEventStats(eventId, stats, opts = {}) {
  const entries = Object.entries(stats).filter(
    ([, value]) => value !== undefined && value !== null
  );
  if (entries.length === 0) return;
  const placeholdersList = entries.map(() => '(?, ?, ?)').join(', ');
  const values = entries.flatMap(([statType, value]) => [eventId, statType, JSON.stringify(value)]);
  await runQuery(
    `INSERT INTO event_stats (event_id, stat_type, value) VALUES ${placeholdersList}`,
    values,
    opts
  );
}

async function findById(id, opts = {}) {
  if (!opts.userId) throw new Error('findById requires opts.userId');
  const rows = await runQuery(
    `SELECT ${EVENT_COLUMNS} FROM events WHERE id = ? AND user_id = ?`,
    [id, opts.userId],
    opts
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function getDateRange(id, opts = {}) {
  if (!opts.userId) throw new Error('getDateRange requires opts.userId');
  const rows = await runQuery(
    'SELECT start_date, end_date FROM events WHERE id = ? AND user_id = ?',
    [id, opts.userId],
    opts
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function findMany(filters, opts = {}) {
  if (!opts.userId) throw new Error('findMany requires opts.userId');
  let sql = `SELECT ${EVENT_COLUMNS} FROM events WHERE user_id = ?`;
  const params = [opts.userId];
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
  if (!opts.userId) throw new Error('findManyByIds requires opts.userId');
  const sql = `SELECT ${EVENT_COLUMNS} FROM events WHERE id IN (${placeholders(ids.length)}) AND user_id = ?`;
  const rows = await runQuery(sql, [...ids, opts.userId], opts);
  return Array.isArray(rows) ? rows : [];
}

async function findOverlapping(excludeId, startDate, endDate, limit, opts = {}) {
  if (!opts.userId) throw new Error('findOverlapping requires opts.userId');
  const sql = `
    SELECT ${EVENT_COLUMNS}
    FROM events
    WHERE id != ?
      AND user_id = ?
      AND start_date <= ?
      AND COALESCE(end_date, start_date) >= ?
    ORDER BY start_date DESC
    LIMIT ?
  `;
  const rows = await runQuery(sql, [excludeId, opts.userId, endDate, startDate, limit], opts);
  return Array.isArray(rows) ? rows : [];
}

async function getStatsByEventIds(eventIds, opts = {}) {
  if (!eventIds.length) return [];
  if (!opts.userId) throw new Error('getStatsByEventIds requires opts.userId');
  const sql = `SELECT es.event_id, es.stat_type, es.value
               FROM event_stats es
               JOIN events e ON e.id = es.event_id
               WHERE es.event_id IN (${placeholders(eventIds.length)}) AND e.user_id = ?`;
  const rows = await runQuery(sql, [...eventIds, opts.userId], opts);
  return Array.isArray(rows) ? rows : [];
}

async function getStatsByEventId(eventId, opts = {}) {
  if (!opts.userId) throw new Error('getStatsByEventId requires opts.userId');
  const rows = await runQuery(
    'SELECT es.stat_type, es.value FROM event_stats es JOIN events e ON e.id = es.event_id WHERE es.event_id = ? AND e.user_id = ?',
    [eventId, opts.userId],
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
  if (!opts.userId) throw new Error('deleteById requires opts.userId');
  const result = await runQuery(
    'DELETE FROM events WHERE id = ? AND user_id = ?',
    [id, opts.userId],
    opts
  );
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
