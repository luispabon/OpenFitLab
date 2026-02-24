const { runQuery } = require('./query-helper');
const { placeholders } = require('../utils/transforms');

async function insertStream(streamId, activityId, eventId, type, opts = {}) {
  await runQuery(
    'INSERT INTO streams (id, activity_id, event_id, type) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
    [streamId, activityId, eventId, type],
    opts
  );
}

async function insertStreamDataPointsBatch(streamId, dataPoints, opts = {}) {
  const batchSize = 1000;
  for (let i = 0; i < dataPoints.length; i += batchSize) {
    const batch = dataPoints.slice(i, i + batchSize);
    const batchPlaceholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
    const flatValues = batch.flat();
    await runQuery(
      `INSERT IGNORE INTO stream_data_points (stream_id, time_ms, value, sequence_index) VALUES ${batchPlaceholders}`,
      flatValues,
      opts
    );
  }
}

async function findByActivityAndEvent(activityId, eventId, types, opts = {}) {
  if (!opts.userId) throw new Error('findByActivityAndEvent requires opts.userId');
  let sql =
    'SELECT s.id, s.type FROM streams s JOIN events e ON e.id = s.event_id WHERE s.activity_id = ? AND s.event_id = ? AND e.user_id = ?';
  const params = [activityId, eventId, opts.userId];
  if (types && types.length > 0) {
    sql += ` AND s.type IN (${placeholders(types.length)})`;
    params.push(...types);
  }
  sql += ' ORDER BY s.type';
  const rows = await runQuery(sql, params, opts);
  return Array.isArray(rows) ? rows : [];
}

async function findDataPointsByStreamIds(streamIds, opts = {}) {
  if (!streamIds.length) return [];
  const sql = `SELECT stream_id, time_ms, value, sequence_index
     FROM stream_data_points
     WHERE stream_id IN (${placeholders(streamIds.length)})
     ORDER BY stream_id, sequence_index ASC, time_ms ASC`;
  const rows = await runQuery(sql, streamIds, opts);
  return Array.isArray(rows) ? rows : [];
}

module.exports = {
  insertStream,
  insertStreamDataPointsBatch,
  findByActivityAndEvent,
  findDataPointsByStreamIds,
};
