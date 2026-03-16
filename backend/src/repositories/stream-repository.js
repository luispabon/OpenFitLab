const { runQuery, placeholders } = require('./query-helper');

async function insertStream(streamId, activityId, type, data, opts = {}) {
  await runQuery(
    'INSERT INTO streams (id, activity_id, type, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)',
    [streamId, activityId, type, JSON.stringify(data)],
    opts
  );
}

async function findAllByActivityIds(activityIds, opts = {}) {
  if (!activityIds.length) return [];
  if (!opts.userId) throw new Error('findAllByActivityIds requires opts.userId');
  const sql = `SELECT s.id, s.activity_id, s.type, s.data
     FROM streams s
     JOIN activities a ON a.id = s.activity_id
     JOIN events e ON e.id = a.event_id AND e.user_id = ?
     WHERE s.activity_id IN (${placeholders(activityIds.length)})`;
  const rows = await runQuery(sql, [opts.userId, ...activityIds], opts);
  return Array.isArray(rows) ? rows : [];
}

async function findByActivityAndEvent(activityId, eventId, types, opts = {}) {
  if (!opts.userId) throw new Error('findByActivityAndEvent requires opts.userId');
  let sql =
    'SELECT s.id, s.type, s.data FROM streams s JOIN activities a ON a.id = s.activity_id JOIN events e ON e.id = a.event_id AND e.user_id = ? WHERE s.activity_id = ? AND a.event_id = ?';
  const params = [opts.userId, activityId, eventId];
  if (types && types.length > 0) {
    sql += ` AND s.type IN (${placeholders(types.length)})`;
    params.push(...types);
  }
  sql += ' ORDER BY s.type';
  const rows = await runQuery(sql, params, opts);
  return Array.isArray(rows) ? rows : [];
}

module.exports = {
  insertStream,
  findAllByActivityIds,
  findByActivityAndEvent,
};
