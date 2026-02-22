const defaultDb = require('../db');
const { aggregateStats, mapActivityRow } = require('../utils/transforms');

/**
 * Updates an activity's type and/or device_name. When type is updated, recomputes
 * the event's "Activity Types" stat.
 * @param {string} eventId - Event UUID
 * @param {string} activityId - Activity UUID
 * @param {{ type?: string, deviceName?: string }} updates
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<object | null>} Updated activity JSON or null if not found
 */
async function updateActivity(eventId, activityId, updates, opts = {}) {
  const db = opts.db ?? defaultDb;
  const activity = await db.queryOne(
    'SELECT id, event_id, name, start_date, end_date, type, event_start_date, device_name FROM activities WHERE id = ? AND event_id = ?',
    [activityId, eventId]
  );
  if (!activity) return null;

  const { type: typeUpdate, deviceName } = updates;

  await db.transaction(async (conn) => {
    if (typeUpdate !== undefined && typeUpdate !== null) {
      const typeValue = String(typeUpdate).trim() || null;
      await conn.execute('UPDATE activities SET type = ? WHERE id = ? AND event_id = ?', [
        typeValue,
        activityId,
        eventId,
      ]);
      const [activityRowsResult] = await conn.execute(
        'SELECT type FROM activities WHERE event_id = ?',
        [eventId]
      );
      const activityRows = activityRowsResult || [];
      const types = [...new Set(activityRows.map((r) => r.type).filter(Boolean))].sort();
      await conn.execute(
        'INSERT INTO event_stats (event_id, stat_type, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [eventId, 'Activity Types', JSON.stringify(types)]
      );
    }

    if (deviceName !== undefined && deviceName !== null) {
      const deviceValue = String(deviceName).trim() || null;
      await conn.execute('UPDATE activities SET device_name = ? WHERE id = ? AND event_id = ?', [
        deviceValue,
        activityId,
        eventId,
      ]);
    }
  });

  const [updatedRow] = await db.query(
    'SELECT id, event_id, name, start_date, end_date, type, event_start_date, device_name FROM activities WHERE id = ? AND event_id = ?',
    [activityId, eventId]
  );
  const statsRows = await db.query(
    'SELECT stat_type, value FROM activity_stats WHERE activity_id = ?',
    [activityId]
  );
  const activityStats = aggregateStats(statsRows);
  return mapActivityRow(updatedRow, activityStats);
}

module.exports = { updateActivity };
