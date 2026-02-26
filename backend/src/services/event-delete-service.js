const defaultDb = require('../db');
const eventRepository = require('../repositories/event-repository');
const comparisonRepository = require('../repositories/comparison-repository');

/**
 * Deletes an event and any comparisons that reference it.
 *
 * Within a transaction:
 * 1. Find comparisons linked to this event via comparison_events.
 * 2. Delete those comparisons (CASCADE removes their comparison_events rows).
 * 3. Delete the event (CASCADE removes event_stats, activities, activity_stats,
 *    streams, stream_data_points, and any remaining comparison_events rows).
 *
 * @param {string} eventId - Event UUID
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<boolean>} true if deleted, false if event not found
 */
async function deleteEventById(eventId, opts = {}) {
  if (!opts.userId) throw new Error('deleteEventById requires opts.userId');
  const db = opts.db ?? defaultDb;

  return db.transaction(async (conn) => {
    const txOpts = { ...opts, db, conn };

    const linked = await comparisonRepository.findByEventIds([eventId], txOpts);
    if (linked.length > 0) {
      const comparisonIds = linked.map((c) => c.id);
      await comparisonRepository.deleteByIds(comparisonIds, txOpts);
    }

    return eventRepository.deleteById(eventId, txOpts);
  });
}

module.exports = { deleteEventById };
