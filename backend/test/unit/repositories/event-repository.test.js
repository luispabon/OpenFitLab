const { describe, it } = require('node:test');
const { strictEqual, ok, deepStrictEqual } = require('node:assert/strict');
const {
  insertEvent,
  findById,
  findMany,
  findManyByIds,
  getStatsByEventIds,
  getStatsByEventId,
  updateFolderId,
  deleteById,
} = require('../../../src/repositories/event-repository');

describe('event-repository', () => {
  describe('insertEvent', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => ({ affectedRows: 1 }) };
      await new Promise((resolve, reject) => {
        insertEvent({ id: 'e1', start_date: 0, name: 'E' }, { db }).then(reject).catch(resolve);
      });
    });

    it('inserts event row with userId', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      await insertEvent(
        {
          id: 'e1',
          folder_id: null,
          start_date: 1000,
          name: 'Run',
          end_date: null,
          description: null,
          is_merge: 0,
          src_file_type: 'tcx',
          start_timezone: null,
          end_timezone: null,
        },
        { db, userId: 'u1' }
      );
      strictEqual(queries.length, 1);
      ok(queries[0].sql.includes('INSERT INTO events'));
      strictEqual(queries[0].params[0], 'e1');
      strictEqual(queries[0].params[1], 'u1');
    });
  });

  describe('findById', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        findById('e1', { db }).then(reject).catch(resolve);
      });
    });

    it('returns event row when found', async () => {
      const row = { id: 'e1', start_date: 1000, name: 'Run', folder_id: null };
      const db = { query: async () => [row] };
      const result = await findById('e1', { db, userId: 'u1' });
      strictEqual(result.id, 'e1');
    });

    it('returns null when not found', async () => {
      const db = { query: async () => [] };
      const result = await findById('missing', { db, userId: 'u1' });
      strictEqual(result, null);
    });

    it('filters by userId', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push(params);
          return [];
        },
      };
      await findById('e1', { db, userId: 'u1' });
      ok(queries[0].includes('u1'));
    });
  });

  describe('findMany', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        findMany({}, { db }).then(reject).catch(resolve);
      });
    });

    it('returns rows for user', async () => {
      const db = { query: async () => [{ id: 'e1' }] };
      const result = await findMany({}, { db, userId: 'u1' });
      strictEqual(result.length, 1);
    });

    it('applies folderId=unfiled filter', async () => {
      const queries = [];
      const db = {
        query: async (sql) => {
          queries.push(sql);
          return [];
        },
      };
      await findMany({ folderId: 'unfiled' }, { db, userId: 'u1' });
      ok(queries[0].includes('folder_id IS NULL'));
    });

    it('applies specific folderId filter', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [];
        },
      };
      await findMany({ folderId: 'f1' }, { db, userId: 'u1' });
      ok(queries[0].sql.includes('folder_id = ?'));
      ok(queries[0].params.includes('f1'));
    });

    it('caps limit at 200', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push(params);
          return [];
        },
      };
      await findMany({ limit: 9999 }, { db, userId: 'u1' });
      const limitParam = queries[0][queries[0].length - 1];
      strictEqual(limitParam, 200);
    });
  });

  describe('findManyByIds', () => {
    it('returns empty array for empty ids', async () => {
      const db = { query: async () => [] };
      const result = await findManyByIds([], { db, userId: 'u1' });
      deepStrictEqual(result, []);
    });

    it('includes IN clause for ids', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [{ id: 'e1' }];
        },
      };
      await findManyByIds(['e1', 'e2'], { db, userId: 'u1' });
      ok(queries[0].sql.includes('IN ('));
      ok(queries[0].params.includes('e1'));
    });
  });

  describe('getStatsByEventIds', () => {
    it('returns empty array for empty ids', async () => {
      const db = { query: async () => [] };
      const result = await getStatsByEventIds([], { db, userId: 'u1' });
      deepStrictEqual(result, []);
    });

    it('queries event_stats with IN clause', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [{ event_id: 'e1', stat_type: 'Distance', value: 5000 }];
        },
      };
      const result = await getStatsByEventIds(['e1'], { db, userId: 'u1' });
      ok(queries[0].sql.includes('event_stats'));
      strictEqual(result.length, 1);
    });
  });

  describe('getStatsByEventId', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        getStatsByEventId('e1', { db }).then(reject).catch(resolve);
      });
    });

    it('returns stats rows for event', async () => {
      const db = { query: async () => [{ stat_type: 'Distance', value: 5000 }] };
      const result = await getStatsByEventId('e1', { db, userId: 'u1' });
      strictEqual(result.length, 1);
    });
  });

  describe('updateFolderId', () => {
    it('returns true when row updated', async () => {
      const db = { query: async () => ({ affectedRows: 1 }) };
      const result = await updateFolderId('e1', 'f1', { db, userId: 'u1' });
      strictEqual(result, true);
    });

    it('returns false when row not found', async () => {
      const db = { query: async () => ({ affectedRows: 0 }) };
      const result = await updateFolderId('missing', 'f1', { db, userId: 'u1' });
      strictEqual(result, false);
    });
  });

  describe('deleteById', () => {
    it('returns true when deleted', async () => {
      const db = { query: async () => ({ affectedRows: 1 }) };
      const result = await deleteById('e1', { db, userId: 'u1' });
      strictEqual(result, true);
    });

    it('returns false when not found', async () => {
      const db = { query: async () => ({ affectedRows: 0 }) };
      const result = await deleteById('missing', { db, userId: 'u1' });
      strictEqual(result, false);
    });
  });
});
