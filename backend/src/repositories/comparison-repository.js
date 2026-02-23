const { runQuery } = require('./query-helper');

async function create(id, name, eventIds, settings, opts = {}) {
  await runQuery(
    'INSERT INTO comparisons (id, name, event_ids, settings) VALUES (?, ?, ?, ?)',
    [id, name, JSON.stringify(eventIds), settings ? JSON.stringify(settings) : null],
    opts
  );
}

async function findAll(limit, opts = {}) {
  const rows = await runQuery(
    'SELECT id, name, event_ids, settings, created_at FROM comparisons ORDER BY created_at DESC LIMIT ?',
    [limit],
    opts
  );
  return Array.isArray(rows) ? rows : [];
}

async function findById(id, opts = {}) {
  const rows = await runQuery(
    'SELECT id, name, event_ids, settings, created_at FROM comparisons WHERE id = ?',
    [id],
    opts
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function existsById(id, opts = {}) {
  const rows = await runQuery('SELECT id FROM comparisons WHERE id = ?', [id], opts);
  return Array.isArray(rows) ? rows.length > 0 : false;
}

async function deleteById(id, opts = {}) {
  const result = await runQuery('DELETE FROM comparisons WHERE id = ?', [id], opts);
  return result && result.affectedRows === 1;
}

module.exports = {
  create,
  findAll,
  findById,
  existsById,
  deleteById,
};
