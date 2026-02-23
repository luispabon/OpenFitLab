const { describe, it } = require('node:test');
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
        return { affectedRows: 1 };
      });

      const result = await createComparison(' My Compare ', ['e1', 'e2'], { x: 1 }, { db });

      strictEqual(queries.length, 3);
      strictEqual(queries[0].sql, 'INSERT INTO comparisons (id, name, settings) VALUES (?, ?, ?)');
      strictEqual(queries[0].params[1], 'My Compare');
      deepStrictEqual(JSON.parse(queries[0].params[2]), { x: 1 });

      strictEqual(
        queries[1].sql,
        'INSERT INTO comparison_events (comparison_id, event_id) VALUES (?, ?)'
      );
      strictEqual(queries[1].params[1], 'e1');

      strictEqual(
        queries[2].sql,
        'INSERT INTO comparison_events (comparison_id, event_id) VALUES (?, ?)'
      );
      strictEqual(queries[2].params[1], 'e2');

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
        return { affectedRows: 1 };
      });

      const result = await createComparison('Test', ['e1', 'e2'], null, { db });

      strictEqual(queries[0].params[2], null);
      strictEqual(result.settings, null);
    });
  });

  describe('getComparisons', () => {
    it('returns mapped list with event IDs from link table', async () => {
      const db = {
        query: async (sql) => {
          if (sql.includes('FROM comparisons ORDER BY')) {
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

      const result = await getComparisons(50, { db });

      strictEqual(result.length, 1);
      strictEqual(result[0].id, 'c1');
      strictEqual(result[0].name, 'C1');
      deepStrictEqual(result[0].eventIds, ['e1', 'e2']);
      deepStrictEqual(result[0].settings, {});
      strictEqual(result[0].createdAt, new Date('2025-01-01T00:00:00Z').getTime());
    });

    it('returns empty array when no comparisons exist', async () => {
      const db = { query: async () => [] };
      const result = await getComparisons(50, { db });
      deepStrictEqual(result, []);
    });
  });

  describe('getComparisonById', () => {
    it('returns null when not found', async () => {
      const db = { query: async () => [] };
      const result = await getComparisonById('missing', { db });
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

      const result = await getComparisonById('c1', { db });

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

      const result = await getComparisonsByEventIds(['e1', 'e2'], { db });

      strictEqual(result.length, 2);
      strictEqual(result[0].id, 'c1');
      strictEqual(result[0].name, 'Comparison 1');
      strictEqual(typeof result[0].createdAt, 'number');
      strictEqual(result[1].id, 'c2');
    });

    it('returns empty array when no comparisons match', async () => {
      const db = { query: async () => [] };
      const result = await getComparisonsByEventIds(['e1'], { db });
      deepStrictEqual(result, []);
    });

    it('returns empty array for empty input', async () => {
      const db = { query: async () => [] };
      const result = await getComparisonsByEventIds([], { db });
      deepStrictEqual(result, []);
    });
  });

  describe('deleteComparisonById', () => {
    it('returns false when comparison not found', async () => {
      const db = {
        query: async (sql) =>
          sql.includes('SELECT id FROM') ? [] : { affectedRows: 0 },
      };
      const result = await deleteComparisonById('missing', { db });
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
      const result = await deleteComparisonById('c1', { db });
      strictEqual(result, true);
      strictEqual(calls.some((s) => s.includes('DELETE')), true);
    });
  });
});
