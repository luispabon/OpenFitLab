const { describe, it } = require('node:test');
const assert = require('node:assert');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const {
  createComparison,
  getComparisons,
  getComparisonById,
  getComparisonsByEventIds,
  deleteComparisonById,
  updateComparisonFolder,
  updateComparisonSettings,
  updateComparisonName,
} = require('../../../src/services/comparison-service');
const { makeFakeDb } = require('../../helpers/fake-db');

describe('comparison-service', () => {
  describe('createComparison', () => {
    it('inserts comparison and link rows in a transaction, returns result', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('FROM activities a')) {
          return [
            { id: 'a1', event_id: 'e1' },
            { id: 'a2', event_id: 'e2' },
          ];
        }
        return { affectedRows: 1 };
      });

      const result = await createComparison(
        ' My Compare ',
        ['a1', 'a2'],
        { x: 1 },
        { db, userId: 'u1' }
      );

      strictEqual(queries.length, 3);
      const insertComp = queries.find((q) => q.sql.startsWith('INSERT INTO comparisons'));
      strictEqual(Boolean(insertComp), true);
      strictEqual(insertComp.params[3], 'My Compare');
      deepStrictEqual(JSON.parse(insertComp.params[4]), { x: 1 });

      const linkInsert = queries.find((q) =>
        q.sql.includes('INSERT INTO comparison_event_activities')
      );
      strictEqual(Boolean(linkInsert), true);

      strictEqual(typeof result.id, 'string');
      strictEqual(result.name, 'My Compare');
      deepStrictEqual(result.eventIds, ['e1', 'e2']);
      deepStrictEqual(result.activityIds, ['a1', 'a2']);
      deepStrictEqual(result.settings, { x: 1 });
      strictEqual(typeof result.createdAt, 'number');
    });

    it('stores null settings when not provided', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('FROM activities a')) {
          return [
            { id: 'a1', event_id: 'e1' },
            { id: 'a2', event_id: 'e2' },
          ];
        }
        return { affectedRows: 1 };
      });

      const result = await createComparison('Test', ['a1', 'a2'], null, { db, userId: 'u1' });

      const insertComp = queries.find((q) => q.sql.startsWith('INSERT INTO comparisons'));
      strictEqual(Boolean(insertComp), true);
      strictEqual(insertComp.params[4], null);
      strictEqual(result.settings, null);
    });

    it('rejects with statusCode 404 when fewer activities found than requested (transaction rolls back)', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('FROM activities a')) {
          return [{ id: 'a1', event_id: 'e1' }];
        }
        return { affectedRows: 1 };
      });

      await assert.rejects(
        async () => {
          await createComparison('Test', ['a1', 'a2', 'a3'], null, { db, userId: 'u1' });
        },
        (err) => {
          strictEqual(err.statusCode, 404);
          strictEqual(err.message, 'One or more activities not found');
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
                folder_id: null,
                name: 'C1',
                settings: '{}',
                created_at: new Date('2025-01-01T00:00:00Z'),
              },
            ];
          }
          if (sql.includes('FROM comparison_event_activities')) {
            return [
              { comparison_id: 'c1', event_id: 'e1', activity_id: 'a1' },
              { comparison_id: 'c1', event_id: 'e2', activity_id: 'a2' },
            ];
          }
          if (sql.includes('FROM activities')) {
            return [
              { id: 'a1', start_date: 1704067200000 },
              { id: 'a2', start_date: 1704153600000 },
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
      deepStrictEqual(result[0].activityIds, ['a1', 'a2']);
      deepStrictEqual(result[0].settings, {});
      strictEqual(result[0].createdAt, new Date('2025-01-01T00:00:00Z').getTime());
      strictEqual(result[0].referenceActivityStartDate, 1704067200000);
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
                folder_id: null,
                name: 'C1',
                settings: null,
                created_at: new Date('2025-01-01T00:00:00Z'),
              },
            ];
          }
          if (sql.includes('FROM comparison_event_activities')) {
            return [
              { event_id: 'e1', activity_id: 'a1' },
              { event_id: 'e2', activity_id: 'a2' },
            ];
          }
          if (sql.includes('FROM activities')) {
            return [
              { id: 'a1', start_date: 1704067200000 },
              { id: 'a2', start_date: 1704153600000 },
            ];
          }
          return [];
        },
      };

      const result = await getComparisonById('c1', { db, userId: 'u1' });

      strictEqual(result.id, 'c1');
      deepStrictEqual(result.eventIds, ['e1', 'e2']);
      deepStrictEqual(result.activityIds, ['a1', 'a2']);
      strictEqual(result.settings, null);
      strictEqual(result.referenceActivityStartDate, 1704067200000);
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
        query: async (sql) => (sql.includes('SELECT id FROM') ? [] : { affectedRows: 0 }),
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
      strictEqual(
        calls.some((s) => s.includes('DELETE')),
        true
      );
    });
  });

  describe('updateComparisonFolder', () => {
    it('returns false when comparison not found', async () => {
      const db = {
        query: async (sql) => (sql.includes('SELECT id FROM') ? [] : { affectedRows: 0 }),
      };
      const result = await updateComparisonFolder('missing', 'f1', { db, userId: 'u1' });
      strictEqual(result, false);
    });

    it('returns true and updates folder when found', async () => {
      const calls = [];
      const db = {
        query: async (sql, params) => {
          calls.push({ sql, params });
          if (sql.includes('SELECT id FROM')) return [{ id: 'c1' }];
          if (sql.includes('UPDATE comparisons SET folder_id')) {
            strictEqual(params[0], 'f2');
            strictEqual(params[1], 'c1');
            strictEqual(params[2], 'u1');
            return { affectedRows: 1 };
          }
          return [];
        },
      };
      const result = await updateComparisonFolder('c1', 'f2', { db, userId: 'u1' });
      strictEqual(result, true);
      strictEqual(
        calls.some((s) => s.sql.includes('UPDATE comparisons SET folder_id')),
        true
      );
    });

    it('sets folder_id to null when folderId is null (unfiled)', async () => {
      const calls = [];
      const db = {
        query: async (sql, params) => {
          calls.push({ sql, params });
          if (sql.includes('SELECT id FROM')) return [{ id: 'c1' }];
          if (sql.includes('UPDATE comparisons SET folder_id')) {
            strictEqual(params[0], null);
            return { affectedRows: 1 };
          }
          return [];
        },
      };
      const result = await updateComparisonFolder('c1', null, { db, userId: 'u1' });
      strictEqual(result, true);
    });
  });

  describe('updateComparisonSettings', () => {
    it('returns null when comparison not found', async () => {
      const db = {
        query: async () => ({ affectedRows: 0 }),
      };
      const result = await updateComparisonSettings(
        'missing',
        { hiddenStats: ['Distance'] },
        { db, userId: 'u1' }
      );
      strictEqual(result, null);
    });

    it('updates settings and returns them when comparison found', async () => {
      const calls = [];
      const db = {
        query: async (sql, params) => {
          calls.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      const settings = {
        selectedStreams: ['Heart Rate'],
        xAxisMode: 'elapsed',
        hiddenStats: ['Distance'],
      };
      const result = await updateComparisonSettings('c1', settings, { db, userId: 'u1' });

      deepStrictEqual(result, settings);
      const updateCall = calls.find((c) => c.sql.includes('UPDATE comparisons SET settings'));
      strictEqual(Boolean(updateCall), true);
      deepStrictEqual(JSON.parse(updateCall.params[0]), settings);
      strictEqual(updateCall.params[1], 'c1');
      strictEqual(updateCall.params[2], 'u1');
    });

    it('stores null when settings is null', async () => {
      const calls = [];
      const db = {
        query: async (sql, params) => {
          calls.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      const result = await updateComparisonSettings('c1', null, { db, userId: 'u1' });
      strictEqual(result, null);
      const updateCall = calls.find((c) => c.sql.includes('UPDATE comparisons SET settings'));
      strictEqual(updateCall.params[0], null);
    });

    it('throws when userId is not provided', async () => {
      const db = { query: async () => ({ affectedRows: 1 }) };
      await assert.rejects(
        async () => updateComparisonSettings('c1', {}, { db }),
        /updateComparisonSettings requires opts\.userId/
      );
    });
  });

  describe('updateComparisonName', () => {
    it('returns false when comparison not found', async () => {
      const db = {
        query: async (sql) => (sql.includes('SELECT id FROM') ? [] : { affectedRows: 0 }),
      };
      const result = await updateComparisonName('missing', 'New Name', { db, userId: 'u1' });
      strictEqual(result, false);
    });

    it('returns true and updates name when found', async () => {
      const calls = [];
      const db = {
        query: async (sql, params) => {
          calls.push({ sql, params });
          if (sql.includes('SELECT id FROM')) return [{ id: 'c1' }];
          if (sql.includes('UPDATE comparisons SET name')) {
            strictEqual(params[0], 'New Name');
            strictEqual(params[1], 'c1');
            strictEqual(params[2], 'u1');
            return { affectedRows: 1 };
          }
          return [];
        },
      };
      const result = await updateComparisonName('c1', 'New Name', { db, userId: 'u1' });
      strictEqual(result, true);
      strictEqual(
        calls.some((c) => c.sql.includes('UPDATE comparisons SET name')),
        true
      );
    });

    it('trims the name before saving', async () => {
      const calls = [];
      const db = {
        query: async (sql, params) => {
          calls.push({ sql, params });
          if (sql.includes('SELECT id FROM')) return [{ id: 'c1' }];
          if (sql.includes('UPDATE comparisons SET name')) {
            strictEqual(params[0], 'Trimmed Name');
            return { affectedRows: 1 };
          }
          return [];
        },
      };
      const result = await updateComparisonName('c1', '  Trimmed Name  ', { db, userId: 'u1' });
      strictEqual(result, true);
    });

    it('throws when userId is not provided', async () => {
      const db = { query: async () => [{ id: 'c1' }] };
      await assert.rejects(
        async () => updateComparisonName('c1', 'Name', { db }),
        /updateComparisonName requires opts\.userId/
      );
    });
  });
});
