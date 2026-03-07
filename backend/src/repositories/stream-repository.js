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

async function findAllByActivityIds(activityIds, opts = {}) {
  if (!activityIds.length) return [];
  if (!opts.userId) throw new Error('findAllByActivityIds requires opts.userId');
  const sql = `SELECT s.id, s.activity_id, s.event_id, s.type, s.created_at
     FROM streams s
     JOIN events e ON e.id = s.event_id AND e.user_id = ?
     WHERE s.activity_id IN (${placeholders(activityIds.length)})`;
  const rows = await runQuery(sql, [opts.userId, ...activityIds], opts);
  return Array.isArray(rows) ? rows : [];
}

async function findDataPointsByStreamIdsOrdered(streamIds, opts = {}) {
  return findDataPointsByStreamIds(streamIds, opts);
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
  if (!opts.userId) throw new Error('findDataPointsByStreamIds requires opts.userId');
  const sql = `SELECT sdp.stream_id, sdp.time_ms, sdp.value, sdp.sequence_index
     FROM stream_data_points sdp
     JOIN streams s ON s.id = sdp.stream_id
     JOIN events e ON e.id = s.event_id
     WHERE sdp.stream_id IN (${placeholders(streamIds.length)}) AND e.user_id = ?
     ORDER BY sdp.stream_id, sdp.sequence_index ASC, sdp.time_ms ASC`;
  const rows = await runQuery(sql, [...streamIds, opts.userId], opts);
  return Array.isArray(rows) ? rows : [];
}

module.exports = {
  insertStream,
  insertStreamDataPointsBatch,
  findAllByActivityIds,
  findDataPointsByStreamIdsOrdered,
  findByActivityAndEvent,
  findDataPointsByStreamIds,
};
