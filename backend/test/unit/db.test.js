/**
 * Unit tests for db.js. Mocks mysql2/promise and fs so no real DB is required.
 * Uses require hook and cache clearing so db module loads with mocks.
 */
const { describe, it, before, after } = require('node:test');
const { strictEqual, ok, deepStrictEqual } = require('node:assert/strict');
const path = require('path');
const Module = require('module');

const backendDir = path.join(__dirname, '..', '..');
const dbPath = path.join(backendDir, 'src', 'db.js');
const dbPathResolved = require.resolve(dbPath);

let db;
let originalRequire;
let createPoolCalls;
let poolRefs;
let mockConn;
let mockFsReadFileSync;

function createMockPool() {
  const pool = {
    execute: async () => [[]],
    getConnection: async () => mockConn,
    end: async () => {},
  };
  poolRefs.push(pool);
  return pool;
}

function installMocks() {
  createPoolCalls = [];
  poolRefs = [];

  const mockMysql = {
    createPool(config) {
      createPoolCalls.push(config);
      return createMockPool();
    },
  };

  mockFsReadFileSync = null;
  const mockFs = {
    readFileSync(filePath, encoding) {
      mockFsReadFileSync = { filePath, encoding };
      return 'CREATE TABLE IF NOT EXISTS test (id INT);';
    },
  };

  originalRequire = Module.prototype.require;
  Module.prototype.require = function (id) {
    if (id === 'mysql2/promise') return mockMysql;
    if (id === 'fs') return mockFs;
    return originalRequire.apply(this, arguments);
  };
}

function uninstallMocks() {
  Module.prototype.require = originalRequire;
  delete require.cache[dbPathResolved];
  try {
    delete require.cache[require.resolve('mysql2/promise')];
  } catch (_) {}
}

before(() => {
  installMocks();
  delete require.cache[dbPathResolved];
  try {
    delete require.cache[require.resolve('mysql2/promise')];
  } catch (_) {}
  db = require(dbPath);
});

after(() => {
  uninstallMocks();
});

describe('db', () => {
  describe('getConfig', () => {
    it('returns object with host, user, password, database and pool options', () => {
      const config = db.getConfig();
      strictEqual(typeof config.host, 'string');
      strictEqual(typeof config.user, 'string');
      strictEqual(typeof config.password, 'string');
      strictEqual(typeof config.database, 'string');
      strictEqual(config.waitForConnections, true);
      strictEqual(config.connectionLimit, 10);
      strictEqual(config.queueLimit, 0);
      strictEqual(config.multipleStatements, true);
    });
  });

  describe('getPool', () => {
    it('returns same pool on second call', async () => {
      createPoolCalls.length = 0;
      poolRefs.length = 0;

      const p1 = await db.getPool();
      const p2 = await db.getPool();
      strictEqual(p1, p2);
      strictEqual(createPoolCalls.length, 1);
    });
  });

  describe('runMigrations', () => {
    function makeConn({ lockResult = 1, appliedRows = [], executeCalls, queryCalls } = {}) {
      const _executeCalls = executeCalls || [];
      const _queryCalls = queryCalls || [];
      return {
        _executeCalls,
        _queryCalls,
        execute: async (sql, params) => {
          _executeCalls.push({ sql, params });
          if (sql.includes('GET_LOCK')) return [[{ acquired: lockResult }]];
          if (sql.includes('SELECT filename FROM schema_migrations')) return [appliedRows];
          return [[]];
        },
        query: async (sql) => {
          _queryCalls.push(sql);
          return [[]];
        },
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: async () => {},
      };
    }

    function makeEnv({ files, fileContents = {}, conn, lockResult, appliedRows }) {
      const _conn = conn || makeConn({ lockResult, appliedRows });
      const adminPool = {
        query: async () => [],
        end: async () => {},
      };
      const mainPool = {
        execute: async () => [[]],
        getConnection: async () => _conn,
        end: async () => {},
      };
      const mockMysql = {
        createPool(config) {
          return config.database ? mainPool : adminPool;
        },
      };
      const mockFs = {
        readdirSync: () => files,
        readFileSync: (filePath) => {
          const name = require('path').basename(filePath);
          return fileContents[name] || `-- migration ${name}`;
        },
      };
      return { mockMysql, mockFs, conn: _conn };
    }

    function withEnv(env, fn) {
      const originalReq = Module.prototype.require;
      Module.prototype.require = function (id) {
        if (id === 'mysql2/promise') return env.mockMysql;
        if (id === 'fs') return env.mockFs;
        return originalReq.apply(this, arguments);
      };
      delete require.cache[dbPathResolved];
      const dbFresh = require(dbPath);
      return fn(dbFresh).finally(() => {
        Module.prototype.require = originalReq;
        delete require.cache[dbPathResolved];
        require(dbPath);
      });
    }

    it('first run: applies all migration files in order and records them', async () => {
      const env = makeEnv({
        files: ['001_initial.sql', '002_add_table.sql'],
        appliedRows: [],
      });
      await withEnv(env, async (dbFresh) => {
        await dbFresh.runMigrations();
        const insertCalls = env.conn._executeCalls.filter(
          (c) => c.sql.includes('INSERT INTO schema_migrations') && c.params
        );
        deepStrictEqual(
          insertCalls.map((c) => c.params[0]),
          ['001_initial.sql', '002_add_table.sql']
        );
        strictEqual(env.conn._queryCalls.length, 2);
      });
    });

    it('subsequent run: skips already-applied migrations', async () => {
      const env = makeEnv({
        files: ['001_initial.sql', '002_add_table.sql'],
        appliedRows: [{ filename: '001_initial.sql' }, { filename: '002_add_table.sql' }],
      });
      await withEnv(env, async (dbFresh) => {
        await dbFresh.runMigrations();
        const insertCalls = env.conn._executeCalls.filter(
          (c) => c.sql.includes('INSERT INTO schema_migrations') && c.params
        );
        strictEqual(insertCalls.length, 0);
        strictEqual(env.conn._queryCalls.length, 0);
      });
    });

    it('new migration: only runs unapplied file', async () => {
      const env = makeEnv({
        files: ['001_initial.sql', '002_new.sql'],
        appliedRows: [{ filename: '001_initial.sql' }],
      });
      await withEnv(env, async (dbFresh) => {
        await dbFresh.runMigrations();
        const insertCalls = env.conn._executeCalls.filter(
          (c) => c.sql.includes('INSERT INTO schema_migrations') && c.params
        );
        deepStrictEqual(
          insertCalls.map((c) => c.params[0]),
          ['002_new.sql']
        );
        strictEqual(env.conn._queryCalls.length, 1);
      });
    });

    it('GET_LOCK returns 0: throws and does not run migrations', async () => {
      const env = makeEnv({ files: ['001_initial.sql'], lockResult: 0 });
      await withEnv(env, async (dbFresh) => {
        await require('node:assert').rejects(
          () => dbFresh.runMigrations(),
          (err) => err.message.includes('migration lock')
        );
        const insertCalls = env.conn._executeCalls.filter(
          (c) => c.sql.includes('INSERT INTO schema_migrations') && c.params
        );
        strictEqual(insertCalls.length, 0);
      });
    });

    it('failed migration SQL: rolls back and error propagates, migration not recorded', async () => {
      const rollbackCalls = [];
      const conn = makeConn({ appliedRows: [] });
      conn.query = async () => {
        throw new Error('syntax error');
      };
      conn.rollback = async () => rollbackCalls.push(1);

      const env = makeEnv({ files: ['001_bad.sql'], conn });
      await withEnv(env, async (dbFresh) => {
        await require('node:assert').rejects(
          () => dbFresh.runMigrations(),
          (err) => err.message === 'syntax error'
        );
        strictEqual(rollbackCalls.length, 1);
        const insertCalls = env.conn._executeCalls.filter(
          (c) => c.sql.includes('INSERT INTO schema_migrations') && c.params
        );
        strictEqual(insertCalls.length, 0);
      });
    });
  });

  describe('query and queryOne', () => {
    it('query returns rows from execute, queryOne returns first row or null', async () => {
      const row1 = { id: 1 };
      const row2 = { id: 2 };
      let executeSql;
      let executeParams;

      const mockPool = {
        execute: async (sql, params) => {
          executeSql = sql;
          executeParams = params;
          return [[row1, row2]];
        },
        getConnection: async () => mockConn,
        end: async () => {},
      };

      createPoolCalls.length = 0;
      poolRefs.length = 0;
      const mockMysql = {
        createPool() {
          createPoolCalls.push({});
          return mockPool;
        },
      };

      const originalReq = Module.prototype.require;
      Module.prototype.require = function (id) {
        if (id === 'mysql2/promise') return mockMysql;
        if (id === 'fs') return { readFileSync: () => '' };
        return originalReq.apply(this, arguments);
      };

      delete require.cache[dbPathResolved];
      const dbFresh = require(dbPath);

      const rows = await dbFresh.query('SELECT * FROM t', [1]);
      deepStrictEqual(rows, [row1, row2]);
      strictEqual(executeSql, 'SELECT * FROM t');
      deepStrictEqual(executeParams, [1]);

      const one = await dbFresh.queryOne('SELECT * FROM t WHERE id = ?', [1]);
      strictEqual(one, row1);

      mockPool.execute = async () => [[]];
      const none = await dbFresh.queryOne('SELECT * FROM empty');
      strictEqual(none, null);

      Module.prototype.require = originalReq;
      delete require.cache[dbPathResolved];
      require(dbPath);
    });
  });

  describe('transaction', () => {
    it('commits and returns result when fn succeeds', async () => {
      const calls = [];
      const conn = {
        beginTransaction: async () => calls.push('begin'),
        commit: async () => calls.push('commit'),
        rollback: async () => calls.push('rollback'),
        release: async () => calls.push('release'),
      };

      const mockPool = {
        execute: async () => [[]],
        getConnection: async () => conn,
        end: async () => {},
      };

      const mockMysql = { createPool: () => mockPool };
      const originalReq = Module.prototype.require;
      Module.prototype.require = function (id) {
        if (id === 'mysql2/promise') return mockMysql;
        if (id === 'fs') return { readFileSync: () => '' };
        return originalReq.apply(this, arguments);
      };

      delete require.cache[dbPathResolved];
      const dbFresh = require(dbPath);

      const result = await dbFresh.transaction(async (c) => {
        strictEqual(c, conn);
        return 'ok';
      });

      strictEqual(result, 'ok');
      deepStrictEqual(calls, ['begin', 'commit', 'release']);

      Module.prototype.require = originalReq;
      delete require.cache[dbPathResolved];
      require(dbPath);
    });

    it('rolls back and releases when fn throws', async () => {
      const calls = [];
      const conn = {
        beginTransaction: async () => calls.push('begin'),
        commit: async () => calls.push('commit'),
        rollback: async () => calls.push('rollback'),
        release: async () => calls.push('release'),
      };

      const mockPool = {
        execute: async () => [[]],
        getConnection: async () => conn,
        end: async () => {},
      };

      const mockMysql = { createPool: () => mockPool };
      const originalReq = Module.prototype.require;
      Module.prototype.require = function (id) {
        if (id === 'mysql2/promise') return mockMysql;
        if (id === 'fs') return { readFileSync: () => '' };
        return originalReq.apply(this, arguments);
      };

      delete require.cache[dbPathResolved];
      const dbFresh = require(dbPath);

      await require('node:assert').rejects(
        async () =>
          dbFresh.transaction(async () => {
            throw new Error('fail');
          }),
        (err) => err.message === 'fail'
      );

      deepStrictEqual(calls, ['begin', 'rollback', 'release']);

      Module.prototype.require = originalReq;
      delete require.cache[dbPathResolved];
      require(dbPath);
    });
  });

  describe('closePool', () => {
    it('calls pool.end and clears pool', async () => {
      const endCalls = [];
      const mockPool = {
        execute: async () => [[]],
        getConnection: async () => ({}),
        end: async () => endCalls.push(1),
      };

      const mockMysql = { createPool: () => mockPool };
      const originalReq = Module.prototype.require;
      Module.prototype.require = function (id) {
        if (id === 'mysql2/promise') return mockMysql;
        if (id === 'fs') return { readFileSync: () => '' };
        return originalReq.apply(this, arguments);
      };

      delete require.cache[dbPathResolved];
      const dbFresh = require(dbPath);

      await dbFresh.getPool();
      await dbFresh.closePool();

      strictEqual(endCalls.length, 1);

      Module.prototype.require = originalReq;
      delete require.cache[dbPathResolved];
      require(dbPath);
    });
  });
});
