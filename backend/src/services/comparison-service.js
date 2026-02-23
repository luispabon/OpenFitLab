const { randomUUID } = require('crypto');
const defaultDb = require('../db');
const comparisonRepository = require('../repositories/comparison-repository');
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
  const repoOpts = { ...opts, db };
  const id = randomUUID();
  await comparisonRepository.create(id, name.trim(), eventIds, settings, repoOpts);
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
  const repoOpts = { ...opts, db };
  const rows = await comparisonRepository.findAll(limit, repoOpts);
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
  const repoOpts = { ...opts, db };
  const row = await comparisonRepository.findById(id, repoOpts);
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
  const repoOpts = { ...opts, db };
  const existing = await comparisonRepository.existsById(id, repoOpts);
  if (!existing) return false;
  await comparisonRepository.deleteById(id, repoOpts);
  return true;
}

module.exports = {
  createComparison,
  getComparisons,
  getComparisonById,
  deleteComparisonById,
};
