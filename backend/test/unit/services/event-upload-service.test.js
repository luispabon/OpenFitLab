const { describe, it } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { mock } = require('node:test');
const FileParser = require('../../../src/parsers/file-parser');
const {
  processUpload,
  buildActivityRecord,
} = require('../../../src/services/event-upload-service');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');
const BASE_MS = 1609459200000;

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
    strictEqual(eventInsert.params, 11);
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

  it('uses parsed event name when filename is empty', async () => {
    const tcxPath = path.join(FIXTURES_DIR, 'minimal.tcx');
    const buffer = fs.readFileSync(tcxPath);
    const parsedEvent = await FileParser.parseFile(buffer, 'tcx', '');
    const db = {
      transaction: async (fn) => fn({ execute: async () => [{}] }),
    };
    const result = await processUpload(buffer, 'tcx', '', { db, userId: 'u1' });
    strictEqual(result.eventJson.name, parsedEvent.name);
  });

  it('uses "Untitled Event" when filename empty and parsed event has no name', async () => {
    const mockEvent = {
      name: '',
      startDate: new Date(BASE_MS),
      toJSON: () => ({
        name: '',
        startDate: BASE_MS,
        endDate: BASE_MS + 60000,
        stats: {},
        description: null,
        isMerge: false,
      }),
      getActivities: () => [],
    };
    mock.method(FileParser, 'parseFile', async () => mockEvent);
    const db = { transaction: async (fn) => fn({ execute: async () => [{}] }) };
    try {
      const result = await processUpload(Buffer.from('x'), 'tcx', '', { db, userId: 'u1' });
      strictEqual(result.eventJson.name, 'Untitled Event');
    } finally {
      FileParser.parseFile.mock.restore();
    }
  });

  it('persists only valid streams and skips invalid (no type or empty dataPoints)', async () => {
    const streamInserts = [];
    const conn = {
      execute: async (sql, params) => {
        if (sql.includes('INSERT INTO streams')) {
          streamInserts.push({ sql, params });
        }
        return [{}];
      },
    };
    const db = { transaction: async (fn) => fn(conn) };

    const mockActivity = {
      startDate: new Date(BASE_MS),
      toJSON: () => ({
        name: 'Activity',
        startDate: BASE_MS,
        endDate: BASE_MS + 60000,
        stats: {},
        streams: [{ type: 'Heart Rate', data: [100, 110] }, { data: [1, 2] }],
        creator: null,
      }),
    };
    const mockEvent = {
      startDate: new Date(BASE_MS),
      toJSON: () => ({
        name: 'Test',
        id: null,
        startDate: BASE_MS,
        endDate: BASE_MS + 60000,
        stats: {},
        description: null,
        isMerge: false,
      }),
      getActivities: () => [mockActivity],
    };

    mock.method(FileParser, 'parseFile', async () => mockEvent);
    try {
      await processUpload(Buffer.from('x'), 'tcx', 'test.tcx', { db, userId: 'u1' });
      strictEqual(streamInserts.length, 1, 'only the valid stream (Heart Rate) should be inserted');
      strictEqual(streamInserts[0].params[3], 'Heart Rate');
    } finally {
      FileParser.parseFile.mock.restore();
    }
  });
});

describe('event-upload-service buildActivityRecord', () => {
  it('defaults type to "Other" when activityJson.type is null or undefined', () => {
    const aid = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    const eventId = 'ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj';
    const withNull = buildActivityRecord(
      { name: 'A', startDate: BASE_MS, endDate: BASE_MS + 60000, type: null },
      aid,
      eventId
    );
    strictEqual(withNull.type, 'Other');
    const withUndefined = buildActivityRecord(
      { name: 'B', startDate: BASE_MS, endDate: BASE_MS + 60000 },
      aid,
      eventId
    );
    strictEqual(withUndefined.type, 'Other');
  });
});
