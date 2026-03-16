const { describe, it } = require('node:test');
const { strictEqual, ok, deepStrictEqual } = require('node:assert/strict');
const {
  create,
  findAll,
  findById,
  findByEventIds,
  existsById,
  deleteById,
  updateFolderId,
  updateSettings,
} = require('../../../src/repositories/comparison-repository');

describe('comparison-repository', () => {
  describe('create', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => ({ affectedRows: 1 }) };
      await new Promise((resolve, reject) => {
        create('c1', 'Test', [], null, { db }).then(reject).catch(resolve);
      });
    });

    it('inserts comparison and activity link rows', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      await create(
        'c1',
        'Test Comparison',
        [{ eventId: 'e1', activityId: 'a1' }],
        null,
        { db, userId: 'u1' }
      );
      const insertComp = queries.find((q) => q.sql.includes('INSERT INTO comparisons'));
      ok(insertComp);
      strictEqual(insertComp.params[0], 'c1');
      strictEqual(insertComp.params[3], 'Test Comparison');

      const insertLinks = queries.find((q) => q.sql.includes('comparison_event_activities'));
      ok(insertLinks);
    });

    it('skips activity link insert when no activities provided', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      await create('c1', 'Empty', [], null, { db, userId: 'u1' });
      const insertLinks = queries.find((q) => q.sql.includes('comparison_event_activities'));
      strictEqual(insertLinks, undefined);
    });
  });

  describe('findAll', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        findAll(10, { db }).then(reject).catch(resolve);
      });
    });

    it('returns empty array when no comparisons', async () => {
      const db = { query: async () => [] };
      const result = await findAll(10, { db, userId: 'u1' });
      deepStrictEqual(result, []);
    });

    it('returns raw comparison rows', async () => {
      const db = {
        query: async () => [{ id: 'c1', name: 'Test', folder_id: null, settings: null, created_at: null }],
      };
      const result = await findAll(10, { db, userId: 'u1' });
      strictEqual(result.length, 1);
      strictEqual(result[0].id, 'c1');
      strictEqual(result[0].event_ids, undefined);
      strictEqual(result[0].activity_ids, undefined);
    });
  });

  describe('findById', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        findById('c1', { db }).then(reject).catch(resolve);
      });
    });

    it('returns null when not found', async () => {
      const db = { query: async () => [] };
      const result = await findById('missing', { db, userId: 'u1' });
      strictEqual(result, null);
    });

    it('returns raw comparison row without event/activity ids', async () => {
      const db = {
        query: async () => [{ id: 'c1', name: 'Test', folder_id: null, settings: null }],
      };
      const result = await findById('c1', { db, userId: 'u1' });
      ok(result);
      strictEqual(result.id, 'c1');
      strictEqual(result.event_ids, undefined);
      strictEqual(result.activity_ids, undefined);
    });
  });

  describe('existsById', () => {
    it('returns true when found', async () => {
      const db = { query: async () => [{ id: 'c1' }] };
      const result = await existsById('c1', { db, userId: 'u1' });
      strictEqual(result, true);
    });

    it('returns false when not found', async () => {
      const db = { query: async () => [] };
      const result = await existsById('missing', { db, userId: 'u1' });
      strictEqual(result, false);
    });
  });

  describe('deleteById', () => {
    it('returns true when deleted', async () => {
      const db = { query: async () => ({ affectedRows: 1 }) };
      const result = await deleteById('c1', { db, userId: 'u1' });
      strictEqual(result, true);
    });

    it('returns false when not found', async () => {
      const db = { query: async () => ({ affectedRows: 0 }) };
      const result = await deleteById('missing', { db, userId: 'u1' });
      strictEqual(result, false);
    });
  });

  describe('findByEventIds', () => {
    it('returns empty array for empty event ids', async () => {
      const result = await findByEventIds([], { userId: 'u1' });
      deepStrictEqual(result, []);
    });

    it('queries with IN clause', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [{ id: 'c1', name: 'Test' }];
        },
      };
      const result = await findByEventIds(['e1'], { db, userId: 'u1' });
      ok(queries[0].sql.includes('IN ('));
      strictEqual(result.length, 1);
    });
  });

  describe('updateFolderId', () => {
    it('returns true when updated', async () => {
      const db = { query: async () => ({ affectedRows: 1 }) };
      const result = await updateFolderId('c1', 'f1', { db, userId: 'u1' });
      strictEqual(result, true);
    });

    it('normalizes empty folderId to null', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push(params);
          return { affectedRows: 1 };
        },
      };
      await updateFolderId('c1', '', { db, userId: 'u1' });
      strictEqual(queries[0][0], null);
    });
  });

  describe('updateSettings', () => {
    it('returns true when updated', async () => {
      const db = { query: async () => ({ affectedRows: 1 }) };
      const result = await updateSettings('c1', { color: 'red' }, { db, userId: 'u1' });
      strictEqual(result, true);
    });

    it('serializes settings as JSON', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push(params);
          return { affectedRows: 1 };
        },
      };
      await updateSettings('c1', { color: 'blue' }, { db, userId: 'u1' });
      strictEqual(queries[0][0], JSON.stringify({ color: 'blue' }));
    });
  });
});
