const defaultDb = require('../db');
const streamRepository = require('../repositories/stream-repository');
const { parseJSONField } = require('../utils/transforms');

/**
 * Fetches stream data for an activity.
 */
async function getStreamsForActivity(eventId, activityId, options = {}, opts = {}) {
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const streamRows = await streamRepository.findByActivityAndEvent(
    activityId,
    eventId,
    options.types,
    repoOpts
  );
  return streamRows.map((row) => ({
    type: row.type,
    data: parseJSONField(row.data, []),
  }));
}

module.exports = { getStreamsForActivity };
