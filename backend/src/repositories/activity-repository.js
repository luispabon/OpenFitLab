const { runQuery } = require('./query-helper');
const { placeholders } = require('../utils/transforms');

const ACTIVITY_COLUMNS =
  'id, event_id, name, start_date, end_date, type, event_start_date, device_name';

async function insertActivity(row, opts = {}) {
  const sql = `INSERT INTO activities (id, event_id, name, start_date, end_date, type, event_start_date, device_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  await runQuery(
    sql,
    [
      row.id,
      row.event_id,
      row.name,
      row.start_date,
      row.end_date,
      row.type,
      row.event_start_date,
      row.device_name,
    ],
    opts
  );
}

async function insertActivityStats(activityId, stats, opts = {}) {
  for (const [statType, value] of Object.entries(stats)) {
    if (value === undefined || value === null) continue;
    if (statType === 'Device Names') continue;
    await runQuery(
      'INSERT INTO activity_stats (activity_id, stat_type, value) VALUES (?, ?, ?)',
      [activityId, statType, JSON.stringify(value)],
      opts
    );
  }
}

async function findByEventId(eventId, opts = {}) {
  const rows = await runQuery(
    `SELECT ${ACTIVITY_COLUMNS} FROM activities WHERE event_id = ?`,
    [eventId],
    opts
  );
  return Array.isArray(rows) ? rows : [];
}

async function findByIdAndEventId(activityId, eventId, opts = {}) {
  const rows = await runQuery(
    `SELECT ${ACTIVITY_COLUMNS} FROM activities WHERE id = ? AND event_id = ?`,
    [activityId, eventId],
    opts
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function findManyByIds(ids, opts = {}) {
  if (!ids.length) return [];
  const sql = `SELECT ${ACTIVITY_COLUMNS} FROM activities WHERE id IN (${placeholders(ids.length)})`;
  const rows = await runQuery(sql, ids, opts);
  return Array.isArray(rows) ? rows : [];
}

async function updateType(activityId, eventId, type, opts = {}) {
  await runQuery(
    'UPDATE activities SET type = ? WHERE id = ? AND event_id = ?',
    [type, activityId, eventId],
    opts
  );
}

async function updateDeviceName(activityId, eventId, deviceName, opts = {}) {
  await runQuery(
    'UPDATE activities SET device_name = ? WHERE id = ? AND event_id = ?',
    [deviceName, activityId, eventId],
    opts
  );
}

async function getTypesByEventId(eventId, opts = {}) {
  const rows = await runQuery('SELECT type FROM activities WHERE event_id = ?', [eventId], opts);
  const list = Array.isArray(rows) ? rows : [];
  return [...new Set(list.map((r) => r.type).filter(Boolean))].sort();
}

async function getStatsByActivityIds(activityIds, opts = {}) {
  if (!activityIds.length) return [];
  const sql = `SELECT activity_id, stat_type, value FROM activity_stats WHERE activity_id IN (${placeholders(activityIds.length)})`;
  const rows = await runQuery(sql, activityIds, opts);
  return Array.isArray(rows) ? rows : [];
}

async function getStatsByActivityId(activityId, opts = {}) {
  const rows = await runQuery(
    'SELECT stat_type, value FROM activity_stats WHERE activity_id = ?',
    [activityId],
    opts
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * Returns { pairRows: Array<{ event_id, activity_id }>, total } for getActivityRows.
 */
async function getActivityRowPairs(params, opts = {}) {
  const limit = Math.min(Math.max(1, Number(params.limit) || 20), 50);
  const offset = Math.max(0, Number(params.offset) || 0);
  const startDate = params.startDate != null ? Number(params.startDate) : null;
  const endDate = params.endDate != null ? Number(params.endDate) : null;
  const activityTypes = Array.isArray(params.activityTypes)
    ? params.activityTypes.map((t) => String(t).trim()).filter(Boolean)
    : params.activityTypes != null
      ? [String(params.activityTypes).trim()].filter(Boolean)
      : [];
  const devices = Array.isArray(params.devices)
    ? params.devices.map((d) => String(d).trim()).filter(Boolean)
    : params.devices != null
      ? [String(params.devices).trim()].filter(Boolean)
      : [];
  const searchRaw = params.search != null ? String(params.search).trim() : '';

  let sql = 'FROM events e INNER JOIN activities a ON e.id = a.event_id WHERE 1=1';
  const queryParams = [];
  if (startDate != null) {
    sql += ' AND COALESCE(a.start_date, e.start_date) >= ?';
    queryParams.push(startDate);
  }
  if (endDate != null) {
    sql += ' AND COALESCE(a.start_date, e.start_date) <= ?';
    queryParams.push(endDate);
  }
  if (activityTypes.length > 0) {
    sql += ` AND a.type IN (${placeholders(activityTypes.length)})`;
    queryParams.push(...activityTypes);
  }
  if (devices.length > 0) {
    sql += ` AND a.device_name IN (${placeholders(devices.length)})`;
    queryParams.push(...devices);
  }
  if (searchRaw.length > 0) {
    const escapeLike = (s) =>
      String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const searchTerm = `%${escapeLike(searchRaw)}%`;
    sql += ' AND (e.name LIKE ? OR a.name LIKE ? OR a.type LIKE ?)';
    queryParams.push(searchTerm, searchTerm, searchTerm);
  }

  const countSql = `SELECT COUNT(*) AS total ${sql}`;
  const countResult = await runQuery(countSql, queryParams, opts);
  const total = Number(
    Array.isArray(countResult) ? countResult[0]?.total : (countResult?.[0]?.total ?? 0)
  );
  if (total === 0) return { pairRows: [], total: 0 };

  const orderAndPage = ' ORDER BY COALESCE(a.start_date, e.start_date) DESC LIMIT ? OFFSET ?';
  const mainParams = [...queryParams, limit, offset];
  const mainSql = `SELECT e.id AS event_id, a.id AS activity_id ${sql}${orderAndPage}`;
  const pairRows = await runQuery(mainSql, mainParams, opts);
  return { pairRows: Array.isArray(pairRows) ? pairRows : [], total };
}

async function getDistinctTypes(opts = {}) {
  const rows = await runQuery(
    "SELECT DISTINCT type FROM activities WHERE type IS NOT NULL AND type != '' ORDER BY type",
    [],
    opts
  );
  return (Array.isArray(rows) ? rows : []).map((r) => r.type.trim()).filter(Boolean);
}

async function getDistinctDeviceNames(opts = {}) {
  const rows = await runQuery(
    "SELECT DISTINCT device_name FROM activities WHERE device_name IS NOT NULL AND device_name != '' ORDER BY device_name ASC",
    [],
    opts
  );
  return (Array.isArray(rows) ? rows : []).map((r) => r.device_name);
}

module.exports = {
  insertActivity,
  insertActivityStats,
  findByEventId,
  findByIdAndEventId,
  findManyByIds,
  updateType,
  updateDeviceName,
  getTypesByEventId,
  getStatsByActivityIds,
  getStatsByActivityId,
  getActivityRowPairs,
  getDistinctTypes,
  getDistinctDeviceNames,
};
