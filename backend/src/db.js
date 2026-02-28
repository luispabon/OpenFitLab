const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const config = require('./config');

let pool = null;

function getConfig() {
  return {
    ...config.db,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
  };
}

async function getPool() {
  if (pool) return pool;
  pool = mysql.createPool(getConfig());
  return pool;
}

async function ensureDatabaseExists() {
  const config = getConfig();
  const dbName = config.database;

  // Connect without specifying database to create it if needed
  const adminConfig = { ...config };
  delete adminConfig.database;

  const adminPool = mysql.createPool(adminConfig);
  try {
    await adminPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`Database '${dbName}' ensured.`);
  } finally {
    await adminPool.end();
  }
}

async function initializeSchema() {
  // Ensure database exists before connecting to it
  await ensureDatabaseExists();

  const p = await getPool();
  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await p.query(sql);
  console.log('Schema initialized.');
}

async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

async function transaction(fn) {
  const p = await getPool();
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  getConfig,
  initializeSchema,
  query,
  queryOne,
  transaction,
  closePool,
};
