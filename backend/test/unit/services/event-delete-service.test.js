const { describe, it } = require('node:test');
const { strictEqual } = require('node:assert/strict');
const { deleteEventById } = require('../../../src/services/event-delete-service');

describe('deleteEventById', () => {
  it('returns true when event is deleted', async () => {
    const db = {
      query: async () => ({ affectedRows: 1 }),
    };
    const result = await deleteEventById('e1', { db });
    strictEqual(result, true);
  });

  it('returns false when event not found', async () => {
    const db = {
      query: async () => ({ affectedRows: 0 }),
    };
    const result = await deleteEventById('missing', { db });
    strictEqual(result, false);
  });
});
