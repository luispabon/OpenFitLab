const { describe, it } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { processUpload } = require('../../../src/services/event-upload-service');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');

describe('event-upload-service processUpload', () => {
  it('persists event and activities via transaction with injected db', async () => {
    const tcxPath = path.join(FIXTURES_DIR, 'minimal.tcx');
    const buffer = fs.readFileSync(tcxPath);
    const executed = [];
    const conn = {
      execute: async (sql, params) => {
        executed.push({ sql: sql.substring(0, 80), params: params?.length ?? 0 });
        return [{}];
      },
    };
    const db = {
      transaction: async (fn) => fn(conn),
    };
    const result = await processUpload(buffer, 'tcx', 'minimal.tcx', { db, userId: 'u1' });
    ok(result.eventId);
    ok(result.eventJson);
    ok(Array.isArray(result.activities));
    strictEqual(typeof result.eventId, 'string');
    strictEqual(result.eventJson.name, 'minimal');
    strictEqual(executed.length >= 1, true);
    const eventInsert = executed.find((e) => e.sql.includes('INSERT INTO events'));
    ok(eventInsert, 'should insert into events');
    strictEqual(eventInsert.params, 8);
  });

  it('uses filename without extension as event name', async () => {
    const tcxPath = path.join(FIXTURES_DIR, 'minimal.tcx');
    const buffer = fs.readFileSync(tcxPath);
    const db = {
      transaction: async (fn) => fn({ execute: async () => [{}] }),
    };
    const result = await processUpload(buffer, 'tcx', 'My Run.tcx', { db, userId: 'u1' });
    strictEqual(result.eventJson.name, 'My Run');
  });

  it('returns activities array with ids nulled in response', async () => {
    const tcxPath = path.join(FIXTURES_DIR, 'minimal.tcx');
    const buffer = fs.readFileSync(tcxPath);
    const db = {
      transaction: async (fn) => fn({ execute: async () => [{}] }),
    };
    const result = await processUpload(buffer, 'tcx', 'minimal.tcx', { db, userId: 'u1' });
    ok(Array.isArray(result.activities));
    for (const a of result.activities) {
      strictEqual(a.id, null);
    }
  });
});
