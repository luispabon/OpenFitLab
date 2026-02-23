const defaultDb = require('../db');
const eventRepository = require('../repositories/event-repository');

/**
 * Deletes an event. The database cascades to event_stats, activities, activity_stats,
 * streams, and stream_data_points via ON DELETE CASCADE.
 * @param {string} eventId - Event UUID
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<boolean>} true if deleted, false if event not found
 */
async function deleteEventById(eventId, opts = {}) {
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  return eventRepository.deleteById(eventId, repoOpts);
}

module.exports = { deleteEventById };
