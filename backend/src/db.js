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

async function runMigrations() {
  await ensureDatabaseExists();

  const p = await getPool();
  const conn = await p.getConnection();
  try {
    const [[lockRow]] = await conn.execute(
      "SELECT GET_LOCK('openfitlab_migrations', 30) AS acquired"
    );
    if (!lockRow || lockRow.acquired === 0 || lockRow.acquired === null) {
      throw new Error('Could not acquire migration lock (GET_LOCK timed out)');
    }

    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename VARCHAR(255) NOT NULL PRIMARY KEY,
          applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `);

      const migrationsDir = path.join(__dirname, '..', 'sql', 'migrations');
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      const [appliedRows] = await conn.execute('SELECT filename FROM schema_migrations');
      const applied = new Set(appliedRows.map((r) => r.filename));

      for (const file of files) {
        if (applied.has(file)) continue;
        // file comes from readdirSync filtered to .sql — not user input
        /* eslint-disable-next-line security/detect-non-literal-fs-filename */
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await conn.beginTransaction();
        try {
          await conn.query(sql);
          await conn.execute('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
          await conn.commit();
          console.log(`Applied: ${file}`);
        } catch (e) {
          await conn.rollback();
          throw e;
        }
      }
    } finally {
      await conn.execute("SELECT RELEASE_LOCK('openfitlab_migrations')");
    }
  } finally {
    conn.release();
  }
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
  runMigrations,
  query,
  queryOne,
  transaction,
  closePool,
};
