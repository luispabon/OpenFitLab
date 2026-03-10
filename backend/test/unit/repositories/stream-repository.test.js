const { describe, it } = require('node:test');
const { strictEqual, ok, deepStrictEqual } = require('node:assert/strict');
const { makeFakeDb } = require('../../helpers/fake-db');
const {
  insertStream,
  insertStreamDataPointsBatch,
  findAllByActivityIds,
  findByActivityAndEvent,
  findDataPointsByStreamIds,
} = require('../../../src/repositories/stream-repository');

describe('stream-repository', () => {
  describe('insertStream', () => {
    it('inserts with ON DUPLICATE KEY UPDATE', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        return { affectedRows: 1 };
      });
      await insertStream('s1', 'a1', 'e1', 'Heart Rate', { db });
      ok(queries[0].sql.includes('INSERT INTO streams'));
      ok(queries[0].sql.includes('ON DUPLICATE KEY'));
      strictEqual(queries[0].params[0], 's1');
    });
  });

  describe('insertStreamDataPointsBatch', () => {
    it('inserts data points in chunks of 1000', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        return { affectedRows: params.length / 4 };
      });
      // 1500 data points — should produce 2 queries
      const dataPoints = Array.from({ length: 1500 }, (_, i) => [
        's1',
        i * 1000,
        JSON.stringify(i),
        i,
      ]);
      await insertStreamDataPointsBatch('s1', dataPoints, { db });
      strictEqual(queries.length, 2);
      // First chunk: 1000 rows × 4 params = 4000 params
      strictEqual(queries[0].params.length, 4000);
      // Second chunk: 500 rows × 4 params = 2000 params
      strictEqual(queries[1].params.length, 2000);
    });

    it('inserts all rows when fewer than 1000', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        return { affectedRows: 1 };
      });
      const dataPoints = [
        ['s1', 0, '1', 0],
        ['s1', 1000, '2', 1],
      ];
      await insertStreamDataPointsBatch('s1', dataPoints, { db });
      strictEqual(queries.length, 1);
    });
  });

  describe('findAllByActivityIds', () => {
    it('returns empty array for empty ids', async () => {
      const result = await findAllByActivityIds([], { userId: 'u1' });
      deepStrictEqual(result, []);
    });

    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        findAllByActivityIds(['a1'], { db }).then(reject).catch(resolve);
      });
    });

    it('queries streams joined to events for ownership check', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [{ id: 's1', activity_id: 'a1', event_id: 'e1', type: 'HR' }];
        },
      };
      const result = await findAllByActivityIds(['a1'], { db, userId: 'u1' });
      ok(queries[0].sql.includes('JOIN events'));
      strictEqual(result.length, 1);
    });
  });

  describe('findByActivityAndEvent', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        findByActivityAndEvent('a1', 'e1', [], { db }).then(reject).catch(resolve);
      });
    });

    it('returns streams without type filter when types is null', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [{ id: 's1', type: 'HR' }];
        },
      };
      const result = await findByActivityAndEvent('a1', 'e1', null, { db, userId: 'u1' });
      ok(!queries[0].sql.includes('s.type IN'));
      strictEqual(result.length, 1);
    });

    it('applies type filter when types array is provided', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [];
        },
      };
      await findByActivityAndEvent('a1', 'e1', ['HR', 'Distance'], { db, userId: 'u1' });
      ok(queries[0].sql.includes('s.type IN'));
      ok(queries[0].params.includes('HR'));
    });
  });

  describe('findDataPointsByStreamIds', () => {
    it('returns empty array for empty ids', async () => {
      const result = await findDataPointsByStreamIds([], { userId: 'u1' });
      deepStrictEqual(result, []);
    });

    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        findDataPointsByStreamIds(['s1'], { db }).then(reject).catch(resolve);
      });
    });

    it('orders results by stream_id, sequence_index, time_ms', async () => {
      const queries = [];
      const db = {
        query: async (sql) => {
          queries.push(sql);
          return [];
        },
      };
      await findDataPointsByStreamIds(['s1'], { db, userId: 'u1' });
      ok(queries[0].includes('ORDER BY'));
      ok(queries[0].includes('sequence_index'));
    });
  });
});
