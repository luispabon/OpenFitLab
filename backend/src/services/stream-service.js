const defaultDb = require('../db');
const streamRepository = require('../repositories/stream-repository');
const { parseJSONField } = require('../utils/transforms');

/**
 * Fetches stream data for an activity.
 */
async function getStreamsForActivity(eventId, activityId, options = {}, opts = {}) {
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const streamTypes = options.types;
  const streamRows = await streamRepository.findByActivityAndEvent(
    activityId,
    eventId,
    streamTypes,
    repoOpts
  );
  if (streamRows.length === 0) return [];

  const streamIds = streamRows.map((r) => r.id);
  const dataPointRows = await streamRepository.findDataPointsByStreamIds(streamIds, repoOpts);

  const dataByStreamId = {};
  for (const row of dataPointRows) {
    if (!dataByStreamId[row.stream_id]) dataByStreamId[row.stream_id] = [];
    dataByStreamId[row.stream_id].push({
      time: row.time_ms,
      value: parseJSONField(row.value),
    });
  }

  return streamRows.map((streamRow) => ({
    type: streamRow.type,
    data: dataByStreamId[streamRow.id] || [],
  }));
}

module.exports = { getStreamsForActivity };
