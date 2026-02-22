const db = require('../db');

/**
 * Deletes an event. The database cascades to event_stats, activities, activity_stats,
 * streams, and stream_data_points via ON DELETE CASCADE.
 * @param {string} eventId - Event UUID
 * @returns {Promise<boolean>} true if deleted, false if event not found
 */
async function deleteEventById(eventId) {
  const pool = await db.getPool();
  const [result] = await pool.execute('DELETE FROM events WHERE id = ?', [eventId]);
  return result.affectedRows === 1;
}

module.exports = { deleteEventById };
