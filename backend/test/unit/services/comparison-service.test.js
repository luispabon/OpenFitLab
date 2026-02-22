const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const {
  createComparison,
  getComparisons,
  getComparisonById,
  deleteComparisonById,
} = require('../../../src/services/comparison-service');

describe('comparison-service', () => {
  describe('createComparison', () => {
    it('inserts and returns comparison with id and trimmed name', async () => {
      let insertSql;
      let insertParams;
      const db = {
        query: async (sql, params) => {
          insertSql = sql;
          insertParams = params;
        },
      };
      const result = await createComparison(' My Compare ', ['e1', 'e2'], { x: 1 }, { db });
      strictEqual(insertSql, 'INSERT INTO comparisons (id, name, event_ids, settings) VALUES (?, ?, ?, ?)');
      strictEqual(insertParams[1], 'My Compare');
      deepStrictEqual(JSON.parse(insertParams[2]), ['e1', 'e2']);
      deepStrictEqual(JSON.parse(insertParams[3]), { x: 1 });
      strictEqual(typeof result.id, 'string');
      strictEqual(result.name, 'My Compare');
      deepStrictEqual(result.eventIds, ['e1', 'e2']);
      deepStrictEqual(result.settings, { x: 1 });
      strictEqual(typeof result.createdAt, 'number');
    });
  });

  describe('getComparisons', () => {
    it('returns mapped list from db rows', async () => {
      const rows = [
        {
          id: 'c1',
          name: 'C1',
          event_ids: '["e1","e2"]',
          settings: '{}',
          created_at: new Date('2025-01-01T00:00:00Z'),
        },
      ];
      const db = { query: async () => rows };
      const result = await getComparisons(50, { db });
      strictEqual(result.length, 1);
      strictEqual(result[0].id, 'c1');
      strictEqual(result[0].name, 'C1');
      deepStrictEqual(result[0].eventIds, ['e1', 'e2']);
      deepStrictEqual(result[0].settings, {});
      strictEqual(result[0].createdAt, new Date('2025-01-01T00:00:00Z').getTime());
    });
  });

  describe('getComparisonById', () => {
    it('returns null when not found', async () => {
      const db = { queryOne: async () => null };
      const result = await getComparisonById('missing', { db });
      strictEqual(result, null);
    });

    it('returns mapped comparison when found', async () => {
      const row = {
        id: 'c1',
        name: 'C1',
        event_ids: ['e1', 'e2'],
        settings: null,
        created_at: new Date('2025-01-01T00:00:00Z'),
      };
      const db = { queryOne: async () => row };
      const result = await getComparisonById('c1', { db });
      strictEqual(result.id, 'c1');
      deepStrictEqual(result.eventIds, ['e1', 'e2']);
      strictEqual(result.settings, null);
    });
  });

  describe('deleteComparisonById', () => {
    it('returns false when comparison not found', async () => {
      const db = { queryOne: async () => null, query: async () => {} };
      const result = await deleteComparisonById('missing', { db });
      strictEqual(result, false);
    });

    it('returns true and deletes when found', async () => {
      const calls = [];
      const db = {
        queryOne: async () => ({ id: 'c1' }),
        query: async (sql) => {
          calls.push(sql);
        },
      };
      const result = await deleteComparisonById('c1', { db });
      strictEqual(result, true);
      strictEqual(calls.some((s) => s.includes('DELETE')), true);
    });
  });
});
