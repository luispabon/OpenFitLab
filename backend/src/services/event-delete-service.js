const db = require('../db');
const { placeholders } = require('../utils/transforms');

/**
 * Deletes an event and all related data (cascade: activity_stats, event_stats,
 * stream_data_points, streams, activities, then events).
 * @param {string} eventId - Event UUID
 * @returns {Promise<boolean>} true if deleted, false if event not found
 */
async function deleteEventById(eventId) {
  const existing = await db.queryOne('SELECT id FROM events WHERE id = ?', [eventId]);
  if (!existing) return false;

  await db.transaction(async (conn) => {
    const [activityRows] = await conn.execute('SELECT id FROM activities WHERE event_id = ?', [eventId]);
    const activityIds = activityRows.map((r) => r.id);

    if (activityIds.length > 0) {
      await conn.execute(
        `DELETE FROM activity_stats WHERE activity_id IN (${placeholders(activityIds.length)})`,
        activityIds
      );
    }
    await conn.execute('DELETE FROM event_stats WHERE event_id = ?', [eventId]);

    const [streamRows] = await conn.execute('SELECT id FROM streams WHERE event_id = ?', [eventId]);
    const streamIds = streamRows.map((r) => r.id);
    if (streamIds.length > 0) {
      await conn.execute(
        `DELETE FROM stream_data_points WHERE stream_id IN (${placeholders(streamIds.length)})`,
        streamIds
      );
    }

    await conn.execute('DELETE FROM streams WHERE event_id = ?', [eventId]);
    await conn.execute('DELETE FROM activities WHERE event_id = ?', [eventId]);
    await conn.execute('DELETE FROM events WHERE id = ?', [eventId]);
  });

  return true;
}

module.exports = { deleteEventById };
