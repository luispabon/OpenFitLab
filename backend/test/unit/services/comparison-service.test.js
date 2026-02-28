const { describe, it } = require('node:test');
const assert = require('node:assert');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const {
  createComparison,
  getComparisons,
  getComparisonById,
  getComparisonsByEventIds,
  deleteComparisonById,
} = require('../../../src/services/comparison-service');

function makeFakeDb(queryFn) {
  return {
    query: queryFn,
    transaction: async (fn) => {
      const fakeConn = {
        execute: async (sql, params) => {
          const result = await queryFn(sql, params);
          return [result];
        },
      };
      return fn(fakeConn);
    },
  };
}

describe('comparison-service', () => {
  describe('createComparison', () => {
    it('inserts comparison and link rows in a transaction, returns result', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('FROM events')) {
          return [
            { id: 'e1' },
            { id: 'e2' },
          ];
        }
        return { affectedRows: 1 };
      });

      const result = await createComparison(' My Compare ', ['e1', 'e2'], { x: 1 }, { db, userId: 'u1' });

      strictEqual(queries.length, 4);
      const insertComp = queries.find((q) => q.sql.startsWith('INSERT INTO comparisons'));
      strictEqual(Boolean(insertComp), true);
      strictEqual(insertComp.params[2], 'My Compare');
      deepStrictEqual(JSON.parse(insertComp.params[3]), { x: 1 });

      const linkInserts = queries.filter((q) => q.sql.includes('INSERT INTO comparison_events'));
      strictEqual(linkInserts.length, 2);
      strictEqual(linkInserts[0].params[1], 'e1');
      strictEqual(linkInserts[1].params[1], 'e2');

      strictEqual(typeof result.id, 'string');
      strictEqual(result.name, 'My Compare');
      deepStrictEqual(result.eventIds, ['e1', 'e2']);
      deepStrictEqual(result.settings, { x: 1 });
      strictEqual(typeof result.createdAt, 'number');
    });

    it('stores null settings when not provided', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('FROM events')) {
          return [
            { id: 'e1' },
            { id: 'e2' },
          ];
        }
        return { affectedRows: 1 };
      });

      const result = await createComparison('Test', ['e1', 'e2'], null, { db, userId: 'u1' });

      const insertComp = queries.find((q) => q.sql.startsWith('INSERT INTO comparisons'));
      strictEqual(Boolean(insertComp), true);
      strictEqual(insertComp.params[3], null);
      strictEqual(result.settings, null);
    });

    it('rejects with statusCode 404 when fewer events found than requested (transaction rolls back)', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('FROM events')) {
          return [{ id: 'e1' }];
        }
        return { affectedRows: 1 };
      });

      await assert.rejects(
        async () => {
          await createComparison('Test', ['e1', 'e2', 'e3'], null, { db, userId: 'u1' });
        },
        (err) => {
          strictEqual(err.statusCode, 404);
          strictEqual(err.message, 'One or more events not found');
          return true;
        }
      );

      const insertComp = queries.find((q) => q.sql.startsWith('INSERT INTO comparisons'));
      strictEqual(insertComp, undefined, 'transaction should roll back; no comparison insert');
    });
  });

  describe('getComparisons', () => {
    it('returns mapped list with event IDs from link table', async () => {
      const db = {
        query: async (sql) => {
          if (sql.includes('FROM comparisons') && sql.includes('ORDER BY')) {
            return [
              {
                id: 'c1',
                name: 'C1',
                settings: '{}',
                created_at: new Date('2025-01-01T00:00:00Z'),
              },
            ];
          }
          if (sql.includes('FROM comparison_events')) {
            return [
              { comparison_id: 'c1', event_id: 'e1' },
              { comparison_id: 'c1', event_id: 'e2' },
            ];
          }
          return [];
        },
      };

      const result = await getComparisons(50, { db, userId: 'u1' });

      strictEqual(result.length, 1);
      strictEqual(result[0].id, 'c1');
      strictEqual(result[0].name, 'C1');
      deepStrictEqual(result[0].eventIds, ['e1', 'e2']);
      deepStrictEqual(result[0].settings, {});
      strictEqual(result[0].createdAt, new Date('2025-01-01T00:00:00Z').getTime());
    });

    it('returns empty array when no comparisons exist', async () => {
      const db = { query: async () => [] };
      const result = await getComparisons(50, { db, userId: 'u1' });
      deepStrictEqual(result, []);
    });
  });

  describe('getComparisonById', () => {
    it('returns null when not found', async () => {
      const db = { query: async () => [] };
      const result = await getComparisonById('missing', { db, userId: 'u1' });
      strictEqual(result, null);
    });

    it('returns mapped comparison with event IDs from link table', async () => {
      const db = {
        query: async (sql) => {
          if (sql.includes('FROM comparisons WHERE id')) {
            return [
              {
                id: 'c1',
                name: 'C1',
                settings: null,
                created_at: new Date('2025-01-01T00:00:00Z'),
              },
            ];
          }
          if (sql.includes('FROM comparison_events')) {
            return [{ event_id: 'e1' }, { event_id: 'e2' }];
          }
          return [];
        },
      };

      const result = await getComparisonById('c1', { db, userId: 'u1' });

      strictEqual(result.id, 'c1');
      deepStrictEqual(result.eventIds, ['e1', 'e2']);
      strictEqual(result.settings, null);
    });
  });

  describe('getComparisonsByEventIds', () => {
    it('returns comparisons linked to any of the given event IDs', async () => {
      const db = {
        query: async () => [
          { id: 'c1', name: 'Comparison 1', created_at: new Date('2025-01-01T00:00:00Z') },
          { id: 'c2', name: 'Comparison 2', created_at: new Date('2025-02-01T00:00:00Z') },
        ],
      };

      const result = await getComparisonsByEventIds(['e1', 'e2'], { db, userId: 'u1' });

      strictEqual(result.length, 2);
      strictEqual(result[0].id, 'c1');
      strictEqual(result[0].name, 'Comparison 1');
      strictEqual(typeof result[0].createdAt, 'number');
      strictEqual(result[1].id, 'c2');
    });

    it('returns empty array when no comparisons match', async () => {
      const db = { query: async () => [] };
      const result = await getComparisonsByEventIds(['e1'], { db, userId: 'u1' });
      deepStrictEqual(result, []);
    });

    it('returns empty array for empty input', async () => {
      const db = { query: async () => [] };
      const result = await getComparisonsByEventIds([], { db, userId: 'u1' });
      deepStrictEqual(result, []);
    });
  });

  describe('deleteComparisonById', () => {
    it('returns false when comparison not found', async () => {
      const db = {
        query: async (sql) =>
          sql.includes('SELECT id FROM') ? [] : { affectedRows: 0 },
      };
      const result = await deleteComparisonById('missing', { db, userId: 'u1' });
      strictEqual(result, false);
    });

    it('returns true and deletes when found', async () => {
      const calls = [];
      const db = {
        query: async (sql) => {
          calls.push(sql);
          if (sql.includes('SELECT id FROM')) return [{ id: 'c1' }];
          if (sql.includes('DELETE')) return { affectedRows: 1 };
          return [];
        },
      };
      const result = await deleteComparisonById('c1', { db, userId: 'u1' });
      strictEqual(result, true);
      strictEqual(calls.some((s) => s.includes('DELETE')), true);
    });
  });
});
