const { describe, it } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const { makeFakeDb } = require('../../helpers/fake-db');
const { exportEventAsTcx, exportEventAsGpx } = require('../../../src/services/export-service');

const EVENT_ID = 'evt-uuid-1';
const ACT_ID = 'act-uuid-1';
const USER_ID = 'user-1';

const fakeEventRow = {
  id: EVENT_ID,
  start_date: 1700000000000,
  name: 'Morning Run',
  end_date: null,
  folder_id: null,
  description: null,
  is_merge: 0,
  src_file_type: 'tcx',
  start_timezone: null,
  end_timezone: null,
};

const fakeActivityRow = {
  id: ACT_ID,
  event_id: EVENT_ID,
  name: null,
  start_date: 1700000000000,
  end_date: null,
  type: 'Running',
  device_name: 'Garmin',
  start_timezone: null,
  end_timezone: null,
  created_at: 1700000000000,
};

const fakeGpsStreamRow = {
  id: `${ACT_ID}_Latitude`,
  activity_id: ACT_ID,
  type: 'Latitude',
  data: JSON.stringify([{ time: 1700000000000, value: 51.5 }]),
};

const fakeLonStreamRow = {
  id: `${ACT_ID}_Longitude`,
  activity_id: ACT_ID,
  type: 'Longitude',
  data: JSON.stringify([{ time: 1700000000000, value: -0.1 }]),
};

function makeDb(eventRow, activityRows, statRows, streamRows) {
  return makeFakeDb(async (sql) => {
    if (sql.includes('FROM events') && sql.includes('WHERE id')) return eventRow ? [eventRow] : [];
    if (sql.includes('FROM activities') && sql.includes('WHERE a.event_id')) return activityRows;
    if (sql.includes('FROM activity_stats')) return statRows;
    if (sql.includes('FROM streams')) return streamRows;
    return [];
  });
}

describe('exportEventAsTcx', () => {
  it('returns null when event not found', async () => {
    const db = makeDb(null, [], [], []);
    const result = await exportEventAsTcx(EVENT_ID, { db, userId: USER_ID });
    strictEqual(result, null);
  });

  it('calls findById with correct eventId and userId', async () => {
    let capturedParams;
    const db = makeFakeDb(async (sql, params) => {
      if (sql.includes('FROM events') && sql.includes('WHERE id')) {
        capturedParams = params;
        return [];
      }
      return [];
    });
    await exportEventAsTcx(EVENT_ID, { db, userId: USER_ID });
    ok(capturedParams.includes(EVENT_ID));
    ok(capturedParams.includes(USER_ID));
  });

  it('returns { xml, name } when event found', async () => {
    const db = makeDb(fakeEventRow, [fakeActivityRow], [], []);
    const result = await exportEventAsTcx(EVENT_ID, { db, userId: USER_ID });
    ok(result != null);
    ok(typeof result.xml === 'string');
    ok(result.xml.startsWith('<?xml'));
    ok(typeof result.name === 'string');
    strictEqual(result.name, 'Morning Run');
  });

  it('parses stream JSON data field before passing to builder', async () => {
    const db = makeDb(fakeEventRow, [fakeActivityRow], [], [fakeGpsStreamRow, fakeLonStreamRow]);
    const result = await exportEventAsTcx(EVENT_ID, { db, userId: USER_ID });
    ok(result != null);
    // TCX should contain the GPS Position elements since streams were parsed
    ok(result.xml.includes('<Position>'));
  });

  it('uses sanitized event name as filename', async () => {
    const eventWithSpecialChars = { ...fakeEventRow, name: 'run/2024:01' };
    const db = makeDb(eventWithSpecialChars, [fakeActivityRow], [], []);
    const result = await exportEventAsTcx(EVENT_ID, { db, userId: USER_ID });
    ok(result != null);
    ok(!result.name.includes('/'));
    ok(!result.name.includes(':'));
  });

  it('handles event with no activities', async () => {
    const db = makeDb(fakeEventRow, [], [], []);
    const result = await exportEventAsTcx(EVENT_ID, { db, userId: USER_ID });
    ok(result != null);
    ok(result.xml.includes('<TrainingCenterDatabase'));
  });
});

describe('exportEventAsGpx', () => {
  it('returns null when event not found', async () => {
    const db = makeDb(null, [], [], []);
    const result = await exportEventAsGpx(EVENT_ID, { db, userId: USER_ID });
    strictEqual(result, null);
  });

  it('returns null when no activity has GPS streams', async () => {
    const hrStream = {
      id: `${ACT_ID}_HR`,
      activity_id: ACT_ID,
      type: 'Heart Rate',
      data: JSON.stringify([{ time: 1700000000000, value: 140 }]),
    };
    const db = makeDb(fakeEventRow, [fakeActivityRow], [], [hrStream]);
    const result = await exportEventAsGpx(EVENT_ID, { db, userId: USER_ID });
    strictEqual(result, null);
  });

  it('returns { xml, name } when event has GPS streams', async () => {
    const db = makeDb(fakeEventRow, [fakeActivityRow], [], [fakeGpsStreamRow, fakeLonStreamRow]);
    const result = await exportEventAsGpx(EVENT_ID, { db, userId: USER_ID });
    ok(result != null);
    ok(typeof result.xml === 'string');
    ok(result.xml.startsWith('<?xml'));
    ok(result.xml.includes('<gpx'));
    strictEqual(result.name, 'Morning Run');
  });

  it('parses stream JSON data field before passing to builder', async () => {
    const db = makeDb(fakeEventRow, [fakeActivityRow], [], [fakeGpsStreamRow, fakeLonStreamRow]);
    const result = await exportEventAsGpx(EVENT_ID, { db, userId: USER_ID });
    ok(result != null);
    ok(result.xml.includes('<trkpt'));
  });
});
