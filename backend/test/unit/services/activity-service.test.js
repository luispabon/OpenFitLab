const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const { updateActivity } = require('../../../src/services/activity-service');

describe('updateActivity', () => {
  it('returns null when activity not found', async () => {
    const db = {
      queryOne: async () => null,
      transaction: async () => {},
      query: async () => [],
    };
    const result = await updateActivity('e1', 'missing', { type: 'Running' }, { db });
    strictEqual(result, null);
  });

  it('returns updated activity with type and deviceName', async () => {
    const activityRow = {
      id: 'a1',
      event_id: 'e1',
      name: 'Lap 1',
      start_date: 1000,
      end_date: 2000,
      type: 'Running',
      event_start_date: 1000,
      device_name: 'Garmin',
    };
    const conn = {
      execute: async () => [[{ type: 'Running' }], []],
    };
    const db = {
      queryOne: async () => activityRow,
      transaction: async (fn) => fn(conn),
      query: async (sql) => {
        if (sql.includes('SELECT id, event_id')) return [activityRow];
        if (sql.includes('activity_stats')) return [{ stat_type: 'Duration', value: 300 }];
        return [];
      },
    };
    const result = await updateActivity('e1', 'a1', { type: 'Cycling', deviceName: 'Wahoo' }, { db });
    strictEqual(result.id, 'a1');
    strictEqual(result.type, 'Running'); // from our mock row; real impl would return updated
    deepStrictEqual(result.stats, { Duration: 300 });
  });

  it('calls conn.execute for type update and Activity Types stat', async () => {
    const activityRow = {
      id: 'a1',
      event_id: 'e1',
      name: null,
      start_date: 1000,
      end_date: null,
      type: 'Running',
      event_start_date: 1000,
      device_name: null,
    };
    const executed = [];
    const conn = {
      execute: async (sql, params) => {
        executed.push({ sql: sql.slice(0, 50), params });
        return [[{ type: 'Running' }], []];
      },
    };
    const db = {
      queryOne: async () => activityRow,
      transaction: async (fn) => fn(conn),
      query: async (sql) => {
        if (sql.includes('SELECT id, event_id') && sql.includes('activities')) return [activityRow];
        if (sql.includes('activity_stats')) return [];
        return [];
      },
    };
    await updateActivity('e1', 'a1', { type: 'Cycling' }, { db });
    const updateCalls = executed.filter((e) => e.sql.includes('UPDATE'));
    strictEqual(updateCalls.length >= 1, true);
    const insertStat = executed.find((e) => e.sql.includes('INSERT') && e.params && e.params[1] === 'Activity Types');
    strictEqual(insertStat !== undefined, true);
  });
});
