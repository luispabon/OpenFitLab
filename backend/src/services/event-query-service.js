const db = require('../db');
const {
  aggregateStats,
  mapEventRow,
  mapActivityRow,
  placeholders,
} = require('../utils/transforms');

/**
 * Takes raw event DB rows and returns fully mapped event objects with nested
 * activities and stats.
 * @param {Array<object>} eventRows - Raw rows from events table (id, start_date, name, etc.)
 * @returns {Promise<Array<object>>} Event objects with .activities and .stats
 */
async function enrichEventsWithStatsAndActivities(eventRows) {
  if (!eventRows || eventRows.length === 0) return [];

  const eventIds = eventRows.map((r) => r.id);
  const [statsRows, activityRows] = await Promise.all([
    db.query(
      `SELECT event_id, stat_type, value FROM event_stats WHERE event_id IN (${placeholders(eventIds.length)})`,
      eventIds
    ),
    db.query(
      `SELECT id, event_id, name, start_date, end_date, type, event_start_date, device_name FROM activities WHERE event_id IN (${placeholders(eventIds.length)})`,
      eventIds
    ),
  ]);

  const statsByEventId = aggregateStats(statsRows, 'event_id');
  const events = eventRows.map((r) => mapEventRow(r, statsByEventId[r.id]));

  if (activityRows.length > 0) {
    const activityIds = activityRows.map((a) => a.id);
    const activityStatsRows = await db.query(
      `SELECT activity_id, stat_type, value FROM activity_stats WHERE activity_id IN (${placeholders(activityIds.length)})`,
      activityIds
    );
    const statsByActivityId = aggregateStats(activityStatsRows, 'activity_id');
    const activitiesByEventId = {};
    for (const a of activityRows) {
      if (!activitiesByEventId[a.event_id]) activitiesByEventId[a.event_id] = [];
      activitiesByEventId[a.event_id].push(mapActivityRow(a, statsByActivityId[a.id]));
    }
    for (const ev of events) {
      ev.activities = activitiesByEventId[ev.id] || [];
    }
  } else {
    for (const ev of events) {
      ev.activities = [];
    }
  }

  return events;
}

/**
 * Fetches a single event by id with activities and stats.
 * @param {string} eventId - Event UUID
 * @returns {Promise<{ event: object, activities: Array<object> } | null>}
 */
async function getEventById(eventId) {
  const event = await db.queryOne(
    'SELECT id, start_date, name, end_date, description, is_merge, src_file_type FROM events WHERE id = ?',
    [eventId]
  );
  if (!event) return null;

  const activities = await db.query(
    'SELECT id, event_id, name, start_date, end_date, type, event_start_date, device_name FROM activities WHERE event_id = ?',
    [eventId]
  );

  const [eventStatsRows, activityStatsRows] = await Promise.all([
    db.query('SELECT stat_type, value FROM event_stats WHERE event_id = ?', [eventId]),
    activities.length > 0
      ? db.query(
          `SELECT activity_id, stat_type, value FROM activity_stats WHERE activity_id IN (${placeholders(activities.length)})`,
          activities.map((a) => a.id)
        )
      : [],
  ]);

  const eventStats = aggregateStats(eventStatsRows);
  const activityStatsById = aggregateStats(activityStatsRows, 'activity_id');
  const eventJson = mapEventRow(event, eventStats);
  const activitiesJson = activities.map((a) => mapActivityRow(a, activityStatsById[a.id]));

  return { event: eventJson, activities: activitiesJson };
}

/**
 * List events with optional date filter and limit.
 * @param {{ startDate?: number, endDate?: number, limit?: number }} filters
 * @returns {Promise<Array<object>>}
 */
async function listEvents(filters = {}) {
  let sql =
    'SELECT id, start_date, name, end_date, description, is_merge, src_file_type FROM events WHERE 1=1';
  const params = [];
  if (filters.startDate != null) {
    sql += ' AND start_date >= ?';
    params.push(Number(filters.startDate));
  }
  if (filters.endDate != null) {
    sql += ' AND start_date <= ?';
    params.push(Number(filters.endDate));
  }
  sql += ' ORDER BY start_date DESC';
  const limit = Math.min(Number(filters.limit) || 50, 200);
  sql += ' LIMIT ?';
  params.push(limit);
  const rows = await db.query(sql, params);
  if (rows.length === 0) return [];
  return enrichEventsWithStatsAndActivities(rows);
}

/**
 * Paginated activity rows with filters. Returns { rows: Array<{ event, activity }>, total }.
 * @param {{ limit?: number, offset?: number, startDate?: number, endDate?: number, activityTypes?: string[], devices?: string[], search?: string }} params
 * @returns {Promise<{ rows: Array<{ event: object, activity: object }>, total: number }>}
 */
async function getActivityRows(params = {}) {
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
    const escapeLike = (s) => String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const searchTerm = `%${escapeLike(searchRaw)}%`;
    sql += ' AND (e.name LIKE ? OR a.name LIKE ? OR a.type LIKE ?)';
    queryParams.push(searchTerm, searchTerm, searchTerm);
  }

  const countSql = `SELECT COUNT(*) AS total ${sql}`;
  const countResult = await db.query(countSql, queryParams);
  const total = Number(countResult[0]?.total ?? 0);
  if (total === 0) return { rows: [], total: 0 };

  const orderAndPage = ' ORDER BY COALESCE(a.start_date, e.start_date) DESC LIMIT ? OFFSET ?';
  const mainParams = [...queryParams, limit, offset];
  const mainSql = `SELECT e.id AS event_id, a.id AS activity_id ${sql}${orderAndPage}`;
  const pairRows = await db.query(mainSql, mainParams);

  const eventIds = [...new Set(pairRows.map((r) => r.event_id))];
  const activityIds = pairRows.map((r) => r.activity_id);

  const [eventRows, activityRows, eventStatsRows, activityStatsRows] = await Promise.all([
    db.query(
      `SELECT id, start_date, name, end_date, description, is_merge, src_file_type FROM events WHERE id IN (${placeholders(eventIds.length)})`,
      eventIds
    ),
    db.query(
      `SELECT id, event_id, name, start_date, end_date, type, event_start_date, device_name FROM activities WHERE id IN (${placeholders(activityIds.length)})`,
      activityIds
    ),
    db.query(
      `SELECT event_id, stat_type, value FROM event_stats WHERE event_id IN (${placeholders(eventIds.length)})`,
      eventIds
    ),
    db.query(
      `SELECT activity_id, stat_type, value FROM activity_stats WHERE activity_id IN (${placeholders(activityIds.length)})`,
      activityIds
    ),
  ]);

  const eventsById = Object.fromEntries(eventRows.map((r) => [r.id, r]));
  const activitiesById = Object.fromEntries(activityRows.map((r) => [r.id, r]));
  const statsByEventId = aggregateStats(eventStatsRows, 'event_id');
  const statsByActivityId = aggregateStats(activityStatsRows, 'activity_id');

  const rows = pairRows
    .map(({ event_id, activity_id }) => {
      const eventRow = eventsById[event_id];
      const activityRow = activitiesById[activity_id];
      if (!eventRow || !activityRow) return null;
      return {
        event: mapEventRow(eventRow, statsByEventId[event_id]),
        activity: mapActivityRow(activityRow, statsByActivityId[activity_id]),
      };
    })
    .filter(Boolean);

  return { rows, total };
}

/**
 * Returns events that overlap in time with the given source event (for comparison candidates).
 * @param {string} sourceEventId - Event UUID
 * @returns {Promise<Array<object> | null>} Array of events with stats/activities, or null if source event not found
 */
async function getComparisonCandidates(sourceEventId) {
  const sourceEvent = await db.queryOne(
    'SELECT start_date, end_date FROM events WHERE id = ?',
    [sourceEventId]
  );
  if (!sourceEvent) return null;

  const sourceStartDate = Number(sourceEvent.start_date);
  const sourceEndDate = sourceEvent.end_date != null ? Number(sourceEvent.end_date) : sourceStartDate;

  const sql = `
    SELECT id, start_date, name, end_date, description, is_merge, src_file_type
    FROM events
    WHERE id != ?
      AND start_date <= ?
      AND COALESCE(end_date, start_date) >= ?
    ORDER BY start_date DESC
    LIMIT 50
  `;
  const rows = await db.query(sql, [sourceEventId, sourceEndDate, sourceStartDate]);
  if (rows.length === 0) return [];
  return enrichEventsWithStatsAndActivities(rows);
}

module.exports = {
  enrichEventsWithStatsAndActivities,
  getEventById,
  listEvents,
  getActivityRows,
  getComparisonCandidates,
};
