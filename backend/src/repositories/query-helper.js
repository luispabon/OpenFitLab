const defaultDb = require('../db');

/**
 * Run a query and return rows. Uses opts.conn when inside a transaction, else opts.db or defaultDb.
 * @param {string} sql
 * @param {Array} params
 * @param {{ db?: object, conn?: object }} opts
 * @returns {Promise<Array|object>} Rows (or ResultSetHeader for INSERT/UPDATE/DELETE when using conn)
 */
async function runQuery(sql, params, opts = {}) {
  const conn = opts.conn;
  const db = opts.db ?? defaultDb;
  if (conn) {
    const raw = await conn.execute(sql, params);
    const result = Array.isArray(raw) ? raw[0] : raw;
    return result;
  }
  return db.query(sql, params);
}

module.exports = { runQuery };
