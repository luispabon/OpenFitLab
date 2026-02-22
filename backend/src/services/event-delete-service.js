const defaultDb = require('../db');

/**
 * Deletes an event. The database cascades to event_stats, activities, activity_stats,
 * streams, and stream_data_points via ON DELETE CASCADE.
 * @param {string} eventId - Event UUID
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<boolean>} true if deleted, false if event not found
 */
async function deleteEventById(eventId, opts = {}) {
  const db = opts.db ?? defaultDb;
  const pool = await db.getPool();
  const [result] = await pool.execute('DELETE FROM events WHERE id = ?', [eventId]);
  return result.affectedRows === 1;
}

module.exports = { deleteEventById };
