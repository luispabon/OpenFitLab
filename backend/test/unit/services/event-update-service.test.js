const { describe, it } = require('node:test');
const assert = require('node:assert');
const { strictEqual } = require('node:assert/strict');
const { updateEventFolder } = require('../../../src/services/event-update-service');

describe('event-update-service', () => {
  describe('updateEventFolder', () => {
    it('throws when userId is missing', async () => {
      await assert.rejects(
        async () => updateEventFolder('e1', 'f1', {}),
        /updateEventFolder requires opts\.userId/
      );
    });

    it('throws NotFoundError when folder not found', async () => {
      const db = {
        query: async (sql) => {
          if (sql.includes('FROM folders')) return [];
          return [];
        },
      };
      await assert.rejects(
        async () => updateEventFolder('e1', 'f1-uuid', { db, userId: 'u1' }),
        (err) => {
          strictEqual(err.statusCode, 404);
          strictEqual(err.message, 'Folder not found');
          return true;
        }
      );
    });

    it('throws NotFoundError when event not found (affectedRows 0)', async () => {
      const db = {
        query: async (sql) => {
          if (sql.includes('FROM folders')) return [{ id: 'f1' }];
          if (sql.includes('UPDATE events SET folder_id')) return { affectedRows: 0 };
          return [];
        },
      };
      await assert.rejects(
        async () => updateEventFolder('missing', 'f1-uuid', { db, userId: 'u1' }),
        (err) => {
          strictEqual(err.statusCode, 404);
          strictEqual(err.message, 'Event not found');
          return true;
        }
      );
    });

    it('unfiles event when folderId is null', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          if (sql.includes('UPDATE events SET folder_id')) return { affectedRows: 1 };
          if (sql.includes('FROM events WHERE id')) return [{ id: 'e1', folder_id: null }];
          return [];
        },
      };
      await updateEventFolder('e1', null, { db, userId: 'u1' });
      const updateCall = queries.find((q) => q.sql.includes('UPDATE events SET folder_id'));
      assert(updateCall);
      strictEqual(updateCall.params[0], null);
    });

    it('does not query folders table when folderId is null', async () => {
      const queries = [];
      const db = {
        query: async (sql, params) => {
          queries.push({ sql, params });
          if (sql.includes('UPDATE events SET folder_id')) return { affectedRows: 1 };
          if (sql.includes('FROM events WHERE id')) return [{ id: 'e1', folder_id: null }];
          return [];
        },
      };
      await updateEventFolder('e1', null, { db, userId: 'u1' });
      const folderQuery = queries.find((q) => q.sql.includes('FROM folders'));
      strictEqual(folderQuery, undefined);
    });
  });
});
