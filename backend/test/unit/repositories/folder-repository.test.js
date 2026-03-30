const { describe, it } = require('node:test');
const { strictEqual, ok, deepStrictEqual } = require('node:assert/strict');
const {
  create,
  findById,
  findByNameForUser,
  countByUserId,
  countPinnedByUserId,
  listAll,
  update,
  deleteById,
  getEventCountByFolderId,
  getComparisonCountByFolderId,
  getEventCountsByFolderIds,
  getComparisonCountsByFolderIds,
  findEventIdsByFolderId,
  clearEventsFolderId,
  clearComparisonsFolderId,
  deleteComparisonsByFolderId,
} = require('../../../src/repositories/folder-repository');

describe('folder-repository', () => {
  describe('create', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => ({ affectedRows: 1 }) };
      await new Promise((resolve, reject) => {
        create({ id: 'f1', name: 'F', color: '#fff', pinned: false }, { db })
          .then(reject)
          .catch(resolve);
      });
    });

    it('inserts folder row with pinned=1 for pinned:true', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      await create({ id: 'f1', name: 'Training', color: '#ff0000', pinned: true }, { db, userId: 'u1' });
      ok(queries[0].sql.includes('INSERT INTO folders'));
      strictEqual(queries[0].params[2], 'Training');
      strictEqual(queries[0].params[4], 1);
    });

    it('inserts folder row with pinned=0 for pinned:false', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      await create({ id: 'f1', name: 'Base', color: '#000', pinned: false }, { db, userId: 'u1' });
      strictEqual(queries[0].params[4], 0);
    });
  });

  describe('findById', () => {
    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        findById('f1', { db }).then(reject).catch(resolve);
      });
    });

    it('returns folder when found', async () => {
      const db = { query: async () => [{ id: 'f1', name: 'Training' }] };
      const result = await findById('f1', { db, userId: 'u1' });
      strictEqual(result.id, 'f1');
    });

    it('returns null when not found', async () => {
      const db = { query: async () => [] };
      const result = await findById('missing', { db, userId: 'u1' });
      strictEqual(result, null);
    });
  });

  describe('findByNameForUser', () => {
    it('returns folder when name matches', async () => {
      const db = { query: async () => [{ id: 'f1' }] };
      const result = await findByNameForUser('Training', 'u1', { db });
      strictEqual(result.id, 'f1');
    });

    it('returns null when no match', async () => {
      const db = { query: async () => [] };
      const result = await findByNameForUser('Unknown', 'u1', { db });
      strictEqual(result, null);
    });
  });

  describe('countByUserId', () => {
    it('returns count', async () => {
      const db = { query: async () => [{ n: 5 }] };
      const result = await countByUserId('u1', { db });
      strictEqual(result, 5);
    });

    it('returns 0 on empty result', async () => {
      const db = { query: async () => [] };
      const result = await countByUserId('u1', { db });
      strictEqual(result, 0);
    });
  });

  describe('countPinnedByUserId', () => {
    it('returns pinned count', async () => {
      const db = { query: async () => [{ n: 2 }] };
      const result = await countPinnedByUserId('u1', { db });
      strictEqual(result, 2);
    });
  });

  describe('listAll', () => {
    it('returns all folders for user', async () => {
      const db = { query: async () => [{ id: 'f1' }, { id: 'f2' }] };
      const result = await listAll('u1', { db });
      strictEqual(result.length, 2);
    });

    it('returns empty array when none', async () => {
      const db = { query: async () => [] };
      const result = await listAll('u1', { db });
      deepStrictEqual(result, []);
    });
  });

  describe('update', () => {
    it('updates name when provided', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      await update('f1', { name: 'NewName' }, { db, userId: 'u1' });
      ok(queries[0].sql.includes('name = ?'));
      strictEqual(queries[0].params[0], 'NewName');
    });

    it('skips query when no fields provided', async () => {
      let queryCount = 0;
      const db = {
        query: async () => {
          queryCount++;
          return {};
        },
      };
      await update('f1', {}, { db, userId: 'u1' });
      strictEqual(queryCount, 0);
    });

    it('updates color when provided', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return { affectedRows: 1 };
        },
      };
      await update('f1', { color: '#00ff00' }, { db, userId: 'u1' });
      ok(queries[0].sql.includes('color = ?'));
      strictEqual(queries[0].params[0], '#00ff00');
    });
  });

  describe('deleteById', () => {
    it('returns true when deleted', async () => {
      const db = { query: async () => ({ affectedRows: 1 }) };
      const result = await deleteById('f1', { db, userId: 'u1' });
      strictEqual(result, true);
    });

    it('returns false when not found', async () => {
      const db = { query: async () => ({ affectedRows: 0 }) };
      const result = await deleteById('missing', { db, userId: 'u1' });
      strictEqual(result, false);
    });
  });

  describe('getEventCountByFolderId', () => {
    it('returns event count', async () => {
      const db = { query: async () => [{ n: 3 }] };
      const result = await getEventCountByFolderId('f1', { db, userId: 'u1' });
      strictEqual(result, 3);
    });
  });

  describe('getComparisonCountByFolderId', () => {
    it('returns comparison count', async () => {
      const db = { query: async () => [{ n: 1 }] };
      const result = await getComparisonCountByFolderId('f1', { db, userId: 'u1' });
      strictEqual(result, 1);
    });
  });

  describe('getEventCountsByFolderIds', () => {
    it('returns empty object for empty folder ids', async () => {
      const result = await getEventCountsByFolderIds([], { userId: 'u1' });
      deepStrictEqual(result, {});
    });

    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        getEventCountsByFolderIds(['f1'], { db }).then(reject).catch(resolve);
      });
    });

    it('includes user_id in WHERE clause', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [{ folder_id: 'f1', n: 2 }];
        },
      };
      const result = await getEventCountsByFolderIds(['f1'], { db, userId: 'u1' });
      ok(queries[0].sql.includes('user_id = ?'));
      strictEqual(queries[0].params[0], 'f1');
      strictEqual(queries[0].params[1], 'u1');
      strictEqual(result.f1, 2);
    });
  });

  describe('getComparisonCountsByFolderIds', () => {
    it('returns empty object for empty folder ids', async () => {
      const result = await getComparisonCountsByFolderIds([], { userId: 'u1' });
      deepStrictEqual(result, {});
    });

    it('throws when opts.userId is missing', async () => {
      const db = { query: async () => [] };
      await new Promise((resolve, reject) => {
        getComparisonCountsByFolderIds(['f1'], { db }).then(reject).catch(resolve);
      });
    });

    it('includes user_id in WHERE clause', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          return [{ folder_id: 'f1', n: 1 }];
        },
      };
      const result = await getComparisonCountsByFolderIds(['f1'], { db, userId: 'u1' });
      ok(queries[0].sql.includes('user_id = ?'));
      strictEqual(queries[0].params[1], 'u1');
      strictEqual(result.f1, 1);
    });
  });

  describe('findEventIdsByFolderId', () => {
    it('returns event ids', async () => {
      const db = { query: async () => [{ id: 'e1' }, { id: 'e2' }] };
      const result = await findEventIdsByFolderId('f1', { db, userId: 'u1' });
      deepStrictEqual(result, ['e1', 'e2']);
    });
  });

  describe('clearEventsFolderId', () => {
    it('executes UPDATE events SET folder_id = NULL', async () => {
      const queries = [];
      const db = {
        query: async (sql) => {
          queries.push(sql);
          return { affectedRows: 1 };
        },
      };
      await clearEventsFolderId('f1', { db, userId: 'u1' });
      ok(queries[0].includes('folder_id = NULL'));
    });
  });

  describe('clearComparisonsFolderId', () => {
    it('executes UPDATE comparisons SET folder_id = NULL', async () => {
      const queries = [];
      const db = {
        query: async (sql) => {
          queries.push(sql);
          return { affectedRows: 1 };
        },
      };
      await clearComparisonsFolderId('f1', { db, userId: 'u1' });
      ok(queries[0].includes('comparisons'));
      ok(queries[0].includes('folder_id = NULL'));
    });
  });

  describe('deleteComparisonsByFolderId', () => {
    it('executes DELETE comparisons by folder', async () => {
      const queries = [];
      const db = {
        query: async (sql) => {
          queries.push(sql);
          return { affectedRows: 1 };
        },
      };
      await deleteComparisonsByFolderId('f1', { db, userId: 'u1' });
      ok(queries[0].includes('DELETE FROM comparisons'));
    });
  });
});
