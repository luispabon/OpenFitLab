const { runQuery } = require('./query-helper');
const { placeholders } = require('../utils/transforms');

const ACTIVITY_COLUMNS =
  'a.id, a.event_id, a.name, a.start_date, a.end_date, a.type, a.event_start_date, a.device_name, a.start_timezone, a.end_timezone';

async function insertActivity(row, opts = {}) {
  const sql = `INSERT INTO activities (id, event_id, name, start_date, end_date, type, event_start_date, device_name, start_timezone, end_timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
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
      row.start_timezone,
      row.end_timezone,
    ],
    opts
  );
}

async function insertActivityStats(activityId, stats, opts = {}) {
  const entries = Object.entries(stats).filter(([statType, value]) => {
    if (statType === 'Device Names') return false;
    return value !== undefined && value !== null;
  });
  if (entries.length === 0) return;
  const placeholdersList = entries.map(() => '(?, ?, ?)').join(', ');
  const values = entries.flatMap(([statType, value]) => [
    activityId,
    statType,
    JSON.stringify(value),
  ]);
  await runQuery(
    `INSERT INTO activity_stats (activity_id, stat_type, value) VALUES ${placeholdersList}`,
    values,
    opts
  );
}

async function findByEventId(eventId, opts = {}) {
  if (!opts.userId) throw new Error('findByEventId requires opts.userId');
  const rows = await runQuery(
    `SELECT ${ACTIVITY_COLUMNS}
     FROM activities a
     JOIN events e ON e.id = a.event_id
     WHERE a.event_id = ? AND e.user_id = ?`,
    [eventId, opts.userId],
    opts
  );
  return Array.isArray(rows) ? rows : [];
}

async function findByIdAndEventId(activityId, eventId, opts = {}) {
  if (!opts.userId) throw new Error('findByIdAndEventId requires opts.userId');
  const rows = await runQuery(
    `SELECT ${ACTIVITY_COLUMNS}
     FROM activities a
     JOIN events e ON e.id = a.event_id
     WHERE a.id = ? AND a.event_id = ? AND e.user_id = ?`,
    [activityId, eventId, opts.userId],
    opts
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function findManyByIds(ids, opts = {}) {
  if (!ids.length) return [];
  if (!opts.userId) throw new Error('findManyByIds requires opts.userId');
  const sql = `SELECT ${ACTIVITY_COLUMNS}
               FROM activities a
               JOIN events e ON e.id = a.event_id
               WHERE a.id IN (${placeholders(ids.length)}) AND e.user_id = ?`;
  const rows = await runQuery(sql, [...ids, opts.userId], opts);
  return Array.isArray(rows) ? rows : [];
}

async function findManyByEventIds(eventIds, opts = {}) {
  if (!eventIds.length) return [];
  if (!opts.userId) throw new Error('findManyByEventIds requires opts.userId');
  const sql = `SELECT ${ACTIVITY_COLUMNS}
               FROM activities a
               JOIN events e ON e.id = a.event_id
               WHERE a.event_id IN (${placeholders(eventIds.length)}) AND e.user_id = ?`;
  const rows = await runQuery(sql, [...eventIds, opts.userId], opts);
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
  if (!opts.userId) throw new Error('getTypesByEventId requires opts.userId');
  const rows = await runQuery(
    'SELECT a.type FROM activities a JOIN events e ON e.id = a.event_id WHERE a.event_id = ? AND e.user_id = ?',
    [eventId, opts.userId],
    opts
  );
  const list = Array.isArray(rows) ? rows : [];
  return [...new Set(list.map((r) => r.type).filter(Boolean))].sort();
}

async function getStatsByActivityIds(activityIds, opts = {}) {
  if (!activityIds.length) return [];
  if (!opts.userId) throw new Error('getStatsByActivityIds requires opts.userId');
  const sql = `SELECT ast.activity_id, ast.stat_type, ast.value
               FROM activity_stats ast
               JOIN activities a ON a.id = ast.activity_id
               JOIN events e ON e.id = a.event_id
               WHERE ast.activity_id IN (${placeholders(activityIds.length)}) AND e.user_id = ?`;
  const rows = await runQuery(sql, [...activityIds, opts.userId], opts);
  return Array.isArray(rows) ? rows : [];
}

async function getStatsByActivityId(activityId, opts = {}) {
  if (!opts.userId) throw new Error('getStatsByActivityId requires opts.userId');
  const rows = await runQuery(
    'SELECT ast.stat_type, ast.value FROM activity_stats ast JOIN activities a ON a.id = ast.activity_id JOIN events e ON e.id = a.event_id WHERE ast.activity_id = ? AND e.user_id = ?',
    [activityId, opts.userId],
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

  let sql = 'FROM events e INNER JOIN activities a ON e.id = a.event_id WHERE e.user_id = ?';
  const queryParams = [opts.userId];
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

  if (!opts.userId) throw new Error('getActivityRowPairs requires opts.userId');
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
  if (!opts.userId) throw new Error('getDistinctTypes requires opts.userId');
  const rows = await runQuery(
    "SELECT DISTINCT a.type FROM activities a JOIN events e ON e.id = a.event_id WHERE a.type IS NOT NULL AND a.type != '' AND e.user_id = ? ORDER BY a.type",
    [opts.userId],
    opts
  );
  return (Array.isArray(rows) ? rows : []).map((r) => r.type.trim()).filter(Boolean);
}

async function getDistinctDeviceNames(opts = {}) {
  if (!opts.userId) throw new Error('getDistinctDeviceNames requires opts.userId');
  const rows = await runQuery(
    "SELECT DISTINCT a.device_name FROM activities a JOIN events e ON e.id = a.event_id WHERE a.device_name IS NOT NULL AND a.device_name != '' AND e.user_id = ? ORDER BY a.device_name ASC",
    [opts.userId],
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
  findManyByEventIds,
  updateType,
  updateDeviceName,
  getTypesByEventId,
  getStatsByActivityIds,
  getStatsByActivityId,
  getActivityRowPairs,
  getDistinctTypes,
  getDistinctDeviceNames,
};
