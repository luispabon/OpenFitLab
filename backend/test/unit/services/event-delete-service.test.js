const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const { deleteEventById } = require('../../../src/services/event-delete-service');
const { makeFakeDb } = require('../../helpers/fake-db');

describe('deleteEventById', () => {
  it('returns true when event is deleted with no linked comparisons', async () => {
    const queries = [];
    const db = makeFakeDb(async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('FROM comparisons')) return [];
      if (sql.includes('DELETE FROM events')) return { affectedRows: 1 };
      return [];
    });

    const result = await deleteEventById('e1', { db, userId: 'u1' });

    strictEqual(result, true);
    strictEqual(queries.some((q) => q.sql.includes('DELETE FROM comparisons')), false);
    strictEqual(queries.some((q) => q.sql.includes('DELETE FROM events')), true);
  });

  it('returns false when event not found', async () => {
    const db = makeFakeDb(async (sql) => {
      if (sql.includes('FROM comparisons')) return [];
      if (sql.includes('DELETE FROM events')) return { affectedRows: 0 };
      return [];
    });

    const result = await deleteEventById('missing', { db, userId: 'u1' });

    strictEqual(result, false);
  });

  it('deletes linked comparisons before deleting the event', async () => {
    const queries = [];
    const db = makeFakeDb(async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('FROM comparisons c')) {
        return [
          { id: 'c1', name: 'Comp 1', created_at: null },
          { id: 'c2', name: 'Comp 2', created_at: null },
        ];
      }
      if (sql.includes('DELETE FROM comparisons')) return { affectedRows: 2 };
      if (sql.includes('DELETE FROM events')) return { affectedRows: 1 };
      return [];
    });

    const result = await deleteEventById('e1', { db, userId: 'u1' });

    strictEqual(result, true);

    const deleteCompIdx = queries.findIndex((q) => q.sql.includes('DELETE FROM comparisons'));
    const deleteEventIdx = queries.findIndex((q) => q.sql.includes('DELETE FROM events'));

    strictEqual(deleteCompIdx !== -1, true);
    strictEqual(deleteEventIdx !== -1, true);
    strictEqual(deleteCompIdx < deleteEventIdx, true);

    deepStrictEqual(queries[deleteCompIdx].params.slice(0, 2), ['c1', 'c2']);
  });
});
