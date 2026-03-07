const { runQuery } = require('./query-helper');

const FOLDER_COLUMNS = 'id, user_id, name, color, pinned, created_at';

async function create(row, opts = {}) {
  if (!opts.userId) throw new Error('create folder requires opts.userId');
  await runQuery(
    'INSERT INTO folders (id, user_id, name, color, pinned) VALUES (?, ?, ?, ?, ?)',
    [row.id, opts.userId, row.name, row.color, row.pinned ? 1 : 0],
    opts
  );
}

async function findById(id, opts = {}) {
  if (!opts.userId) throw new Error('findById folder requires opts.userId');
  const rows = await runQuery(
    `SELECT ${FOLDER_COLUMNS} FROM folders WHERE id = ? AND user_id = ?`,
    [id, opts.userId],
    opts
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function findByNameForUser(name, userId, opts = {}) {
  const rows = await runQuery(
    'SELECT id FROM folders WHERE user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))',
    [userId, name],
    opts
  );
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function countByUserId(userId, opts = {}) {
  const rows = await runQuery(
    'SELECT COUNT(*) AS n FROM folders WHERE user_id = ?',
    [userId],
    opts
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row && row.n != null ? Number(row.n) : 0;
}

async function countPinnedByUserId(userId, opts = {}) {
  const rows = await runQuery(
    'SELECT COUNT(*) AS n FROM folders WHERE user_id = ? AND pinned = 1',
    [userId],
    opts
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row && row.n != null ? Number(row.n) : 0;
}

async function listAll(userId, opts = {}) {
  const rows = await runQuery(
    `SELECT ${FOLDER_COLUMNS} FROM folders WHERE user_id = ? ORDER BY pinned DESC, name ASC`,
    [userId],
    opts
  );
  return Array.isArray(rows) ? rows : [];
}

async function update(id, updates, opts = {}) {
  if (!opts.userId) throw new Error('update folder requires opts.userId');
  const sets = [];
  const params = [];
  if (updates.name !== undefined) {
    sets.push('name = ?');
    params.push(updates.name);
  }
  if (updates.color !== undefined) {
    sets.push('color = ?');
    params.push(updates.color);
  }
  if (updates.pinned !== undefined) {
    sets.push('pinned = ?');
    params.push(updates.pinned ? 1 : 0);
  }
  if (sets.length === 0) return;
  params.push(id, opts.userId);
  await runQuery(
    `UPDATE folders SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`,
    params,
    opts
  );
}

async function deleteById(id, opts = {}) {
  if (!opts.userId) throw new Error('deleteById folder requires opts.userId');
  const result = await runQuery(
    'DELETE FROM folders WHERE id = ? AND user_id = ?',
    [id, opts.userId],
    opts
  );
  return result && result.affectedRows === 1;
}

async function getEventCountByFolderId(folderId, opts = {}) {
  if (!opts.userId) throw new Error('getEventCountByFolderId requires opts.userId');
  const rows = await runQuery(
    'SELECT COUNT(*) AS n FROM events WHERE folder_id = ? AND user_id = ?',
    [folderId, opts.userId],
    opts
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row && row.n != null ? Number(row.n) : 0;
}

async function getComparisonCountByFolderId(folderId, opts = {}) {
  if (!opts.userId) throw new Error('getComparisonCountByFolderId requires opts.userId');
  const rows = await runQuery(
    'SELECT COUNT(*) AS n FROM comparisons WHERE folder_id = ? AND user_id = ?',
    [folderId, opts.userId],
    opts
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row && row.n != null ? Number(row.n) : 0;
}

module.exports = {
  create,
  findById,
  findByNameForUser,
  countByUserId,
  countPinnedByUserId,
  listAll,
  update,
  deleteById,
  getEventCountByFolderId,
  getComparisonCountByFolderId,
};
