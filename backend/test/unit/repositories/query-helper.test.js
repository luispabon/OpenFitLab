const { describe, it } = require('node:test');
const { strictEqual } = require('node:assert/strict');
const { placeholders, runQueryOne } = require('../../../src/repositories/query-helper');

describe('query-helper', () => {
  describe('placeholders', () => {
    it('returns one placeholder for count 1', () => {
      strictEqual(placeholders(1), '?');
    });

    it('returns comma-separated placeholders for count 3', () => {
      strictEqual(placeholders(3), '?,?,?');
    });

    it('returns empty string for count 0', () => {
      strictEqual(placeholders(0), '');
    });
  });

  describe('runQueryOne', () => {
    it('returns first row from db.query result', async () => {
      const db = { query: async () => [{ id: 'r1' }, { id: 'r2' }] };
      const result = await runQueryOne('SELECT 1', [], { db });
      strictEqual(result.id, 'r1');
    });

    it('returns null when db.query returns empty array', async () => {
      const db = { query: async () => [] };
      const result = await runQueryOne('SELECT 1', [], { db });
      strictEqual(result, null);
    });

    it('uses conn.execute when inside a transaction', async () => {
      let executed = false;
      const conn = {
        execute: async () => {
          executed = true;
          return [[{ id: 'tx1' }]];
        },
      };
      const result = await runQueryOne('SELECT 1', [], { conn });
      strictEqual(result.id, 'tx1');
      strictEqual(executed, true);
    });
  });
});
