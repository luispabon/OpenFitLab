const defaultDb = require('../db');
const { parseJSONField, placeholders } = require('../utils/transforms');

/**
 * Fetches stream data for an activity.
 * @param {string} eventId - Event UUID
 * @param {string} activityId - Activity UUID
 * @param {{ types?: string[] }} [options] - Optional filter by stream types
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<Array<{ type: string, data: Array<{ time: number, value: unknown }> }>>}
 */
async function getStreamsForActivity(eventId, activityId, options = {}, opts = {}) {
  const db = opts.db ?? defaultDb;
  let sql = 'SELECT id, type FROM streams WHERE activity_id = ? AND event_id = ?';
  const params = [activityId, eventId];

  const streamTypes = options.types;
  if (streamTypes && streamTypes.length > 0) {
    sql += ` AND type IN (${placeholders(streamTypes.length)})`;
    params.push(...streamTypes);
  }
  sql += ' ORDER BY type';

  const streamRows = await db.query(sql, params);
  if (streamRows.length === 0) return [];

  const streamIds = streamRows.map((r) => r.id);
  const dataPointRows = await db.query(
    `SELECT stream_id, time_ms, value, sequence_index
     FROM stream_data_points
     WHERE stream_id IN (${placeholders(streamIds.length)})
     ORDER BY stream_id, sequence_index ASC, time_ms ASC`,
    streamIds
  );

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
