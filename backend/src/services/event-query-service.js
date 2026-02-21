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

module.exports = {
  enrichEventsWithStatsAndActivities,
  getEventById,
};
