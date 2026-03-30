const { describe, it } = require('node:test');
const { strictEqual, ok, deepStrictEqual } = require('node:assert/strict');
const { makeFakeDb } = require('../../helpers/fake-db');
const {
  insertStream,
  insertStreams,
  findAllByActivityIds,
  findByActivityAndEvent,
} = require('../../../src/repositories/stream-repository');

describe('stream-repository', () => {
  describe('insertStream', () => {
    it('inserts with data and ON DUPLICATE KEY UPDATE', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        return { affectedRows: 1 };
      });
      const data = [{ time: 1000, value: 120 }];
      await insertStream('s1', 'a1', 'Heart Rate', data, { db });
      ok(queries[0].sql.includes('INSERT INTO streams'));
      ok(queries[0].sql.includes('ON DUPLICATE KEY'));
      ok(queries[0].sql.includes('data'));
      ok(!queries[0].sql.includes('event_id'));
      strictEqual(queries[0].params[0], 's1');
      strictEqual(queries[0].params[3], JSON.stringify(data));
    });
  });

  describe('insertStreams', () => {
    it('inserts multiple rows in one statement', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        return { affectedRows: 2 };
      });
      await insertStreams(
        [
          { id: 's1', activityId: 'a1', type: 'HR', data: [{ time: 1, value: 1 }] },
          { id: 's2', activityId: 'a1', type: 'Cadence', data: [{ time: 1, value: 90 }] },
        ],
        { db }
      );
      strictEqual(queries.length, 1);
      ok(queries[0].sql.includes('(?, ?, ?, ?), (?, ?, ?, ?)'));
      ok(queries[0].sql.includes('ON DUPLICATE KEY'));
      strictEqual(queries[0].params.length, 8);
      strictEqual(queries[0].params[1], 'a1');
      strictEqual(queries[0].params[5], 'a1');
    });

    it('no-ops for empty array', async () => {
      let calls = 0;
      const db = makeFakeDb(async () => {
        calls += 1;
        return { affectedRows: 0 };
      });
      await insertStreams([], { db });
      strictEqual(calls, 0);
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

    it('queries streams with data column and ownership check', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [{ id: 's1', activity_id: 'a1', type: 'HR', data: '[]' }];
        },
      };
      const result = await findAllByActivityIds(['a1'], { db, userId: 'u1' });
      ok(queries[0].sql.includes('JOIN activities'));
      ok(queries[0].sql.includes('JOIN events'));
      ok(queries[0].sql.includes('s.data'));
      ok(!queries[0].sql.includes('created_at'));
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

    it('returns streams with data when types is null', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [{ id: 's1', type: 'HR', data: '[]' }];
        },
      };
      const result = await findByActivityAndEvent('a1', 'e1', null, { db, userId: 'u1' });
      ok(queries[0].sql.includes('JOIN activities'));
      ok(queries[0].sql.includes('s.data'));
      ok(!queries[0].sql.includes('s.type IN'));
      strictEqual(queries[0].params[0], 'u1', 'first param is userId');
      strictEqual(queries[0].params[1], 'a1', 'second param is activityId');
      strictEqual(queries[0].params[2], 'e1', 'third param is eventId');
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
      strictEqual(queries[0].params[0], 'u1', 'first param is userId');
      strictEqual(queries[0].params[1], 'a1', 'second param is activityId');
      strictEqual(queries[0].params[2], 'e1', 'third param is eventId');
      strictEqual(queries[0].params[3], 'HR');
      strictEqual(queries[0].params[4], 'Distance');
    });
  });
});
