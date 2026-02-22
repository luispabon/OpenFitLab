const { randomUUID } = require('crypto');
const defaultDb = require('../db');
const { parseJSONField } = require('../utils/transforms');

/**
 * @param {string} name
 * @param {string[]} eventIds
 * @param {object | null} settings
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<object>} { id, name, eventIds, settings, createdAt }
 */
async function createComparison(name, eventIds, settings, opts = {}) {
  const db = opts.db ?? defaultDb;
  const id = randomUUID();
  await db.query('INSERT INTO comparisons (id, name, event_ids, settings) VALUES (?, ?, ?, ?)', [
    id,
    name.trim(),
    JSON.stringify(eventIds),
    settings ? JSON.stringify(settings) : null,
  ]);
  return {
    id,
    name: name.trim(),
    eventIds,
    settings: settings || null,
    createdAt: Date.now(),
  };
}

/**
 * @param {number} limit
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<Array<object>>}
 */
async function getComparisons(limit = 100, opts = {}) {
  const db = opts.db ?? defaultDb;
  const rows = await db.query(
    'SELECT id, name, event_ids, settings, created_at FROM comparisons ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    eventIds: parseJSONField(row.event_ids, []),
    settings: parseJSONField(row.settings, null),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
  }));
}

/**
 * @param {string} id
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<object | null>}
 */
async function getComparisonById(id, opts = {}) {
  const db = opts.db ?? defaultDb;
  const row = await db.queryOne(
    'SELECT id, name, event_ids, settings, created_at FROM comparisons WHERE id = ?',
    [id]
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    eventIds: parseJSONField(row.event_ids, []),
    settings: parseJSONField(row.settings, null),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
  };
}

/**
 * @param {string} id
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
async function deleteComparisonById(id, opts = {}) {
  const db = opts.db ?? defaultDb;
  const existing = await db.queryOne('SELECT id FROM comparisons WHERE id = ?', [id]);
  if (!existing) return false;
  await db.query('DELETE FROM comparisons WHERE id = ?', [id]);
  return true;
}

module.exports = {
  createComparison,
  getComparisons,
  getComparisonById,
  deleteComparisonById,
};
