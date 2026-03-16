const { describe, it } = require('node:test');
const assert = require('node:assert');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const {
  listFolders,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
  MAX_FOLDERS_PER_USER,
  MAX_PINNED_FOLDERS,
} = require('../../../src/services/folder-service');
const { makeFakeDb } = require('../../helpers/fake-db');

describe('folder-service', () => {
  describe('createFolder', () => {
    it('creates folder and returns it with counts', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('COUNT(*)')) return [{ n: 0 }];
        if (sql.includes('LOWER(TRIM(name))')) return [];
        if (sql.includes('INSERT INTO folders')) return { affectedRows: 1 };
        if (sql.includes('SELECT') && sql.includes('folders')) {
          return [
            {
              id: params[0],
              user_id: 'u1',
              name: 'Test',
              color: '#ff0000',
              pinned: 0,
              created_at: new Date(),
            },
          ];
        }
        if (sql.includes('COUNT(*)') && sql.includes('events')) return [{ n: 0 }];
        if (sql.includes('COUNT(*)') && sql.includes('comparisons')) return [{ n: 0 }];
        return [];
      });

      const result = await createFolder({ name: ' Test ', color: '#ff0000' }, { db, userId: 'u1' });

      strictEqual(typeof result.id, 'string');
      strictEqual(result.name, 'Test');
      strictEqual(result.color, '#ff0000');
      strictEqual(result.pinned, false);
      strictEqual(result.eventCount, 0);
      strictEqual(result.comparisonCount, 0);
      const insertQuery = queries.find((q) => q.sql.includes('INSERT INTO folders'));
      assert(insertQuery);
      strictEqual(insertQuery.params[2], 'Test');
      strictEqual(insertQuery.params[3], '#ff0000');
    });

    it('rejects when at max folders', async () => {
      const db = makeFakeDb(async (sql) => {
        if (sql.includes('COUNT(*)') && sql.includes('FROM folders'))
          return [{ n: MAX_FOLDERS_PER_USER }];
        return [];
      });

      await assert.rejects(
        () => createFolder({ name: 'New', color: '#000' }, { db, userId: 'u1' }),
        (err) => err.message.includes(`Maximum ${MAX_FOLDERS_PER_USER}`)
      );
    });

    it('rejects duplicate name (case-insensitive)', async () => {
      const db = makeFakeDb(async (sql) => {
        if (sql.includes('COUNT(*)')) return [{ n: 0 }];
        if (sql.includes('LOWER(TRIM(name))')) return [{ id: 'existing-id' }];
        return [];
      });

      await assert.rejects(
        () => createFolder({ name: 'Marathon', color: '#000' }, { db, userId: 'u1' }),
        (err) => err.message.includes('already have a folder')
      );
    });
  });

  describe('listFolders', () => {
    it('returns folders with event and comparison counts', async () => {
      const db = makeFakeDb(async (sql) => {
        if (sql.includes('ORDER BY pinned')) {
          return [
            {
              id: 'f1',
              user_id: 'u1',
              name: 'A',
              color: '#111',
              pinned: 1,
              created_at: new Date(),
            },
          ];
        }
        if (sql.includes('FROM events WHERE folder_id IN')) return [{ folder_id: 'f1', n: 3 }];
        if (sql.includes('FROM comparisons WHERE folder_id IN')) return [{ folder_id: 'f1', n: 1 }];
        return [];
      });

      const list = await listFolders({ db, userId: 'u1' });
      strictEqual(list.length, 1);
      strictEqual(list[0].id, 'f1');
      strictEqual(list[0].name, 'A');
      strictEqual(list[0].pinned, true);
      strictEqual(list[0].eventCount, 3);
      strictEqual(list[0].comparisonCount, 1);
    });
  });

  describe('deleteFolder', () => {
    it('unfiles contents when contents=unfile', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('SELECT') && sql.includes('FROM folders')) return [{ id: 'f1' }];
        if (sql.includes('UPDATE events SET folder_id = NULL')) return { affectedRows: 2 };
        if (sql.includes('UPDATE comparisons SET folder_id = NULL')) return { affectedRows: 0 };
        if (sql.includes('DELETE FROM folders')) return { affectedRows: 1 };
        return [];
      });

      const deleted = await deleteFolder('f1', 'unfile', { db, userId: 'u1' });
      strictEqual(deleted, true);
      const updateEvents = queries.find((q) => q.sql.includes('UPDATE events'));
      const updateComps = queries.find((q) => q.sql.includes('UPDATE comparisons'));
      const deleteFolderQuery = queries.find((q) => q.sql.includes('DELETE FROM folders'));
      assert(updateEvents);
      assert(updateComps);
      assert(deleteFolderQuery);
    });
  });
});
