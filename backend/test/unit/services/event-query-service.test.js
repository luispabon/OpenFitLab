const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const {
  enrichEventsWithStatsAndActivities,
  getEventById,
  listEvents,
  getActivityRows,
  getComparisonCandidates,
} = require('../../../src/services/event-query-service');

describe('enrichEventsWithStatsAndActivities', () => {
  it('returns empty array for empty eventRows', async () => {
    const db = { query: async () => [] };
    const result = await enrichEventsWithStatsAndActivities([], { db, userId: 'u1' });
    deepStrictEqual(result, []);
  });

  it('returns empty array for null eventRows', async () => {
    const db = { query: async () => [] };
    const result = await enrichEventsWithStatsAndActivities(null, { db, userId: 'u1' });
    deepStrictEqual(result, []);
  });

  it('enriches single event with stats and activities', async () => {
    const eventRows = [
      {
        id: 'e1',
        start_date: 1000,
        name: 'Run',
        end_date: 2000,
        description: null,
        is_merge: 0,
        src_file_type: 'tcx',
      },
    ];
    const db = {
      query: async (sql, params) => {
        if (sql.includes('event_stats'))
          return [{ event_id: 'e1', stat_type: 'Distance', value: 5000 }];
        if (sql.includes('activity_stats'))
          return [{ activity_id: 'a1', stat_type: 'Duration', value: 300 }];
        if (sql.includes('activities') && !sql.includes('activity_stats')) {
          return [
            {
              id: 'a1',
              event_id: 'e1',
              name: 'Lap 1',
              start_date: 1000,
              end_date: 2000,
              type: 'Running',
              device_name: 'Garmin',
            },
          ];
        }
        return [];
      },
    };
    const result = await enrichEventsWithStatsAndActivities(eventRows, { db, userId: 'u1' });
    strictEqual(result.length, 1);
    strictEqual(result[0].id, 'e1');
    strictEqual(result[0].startDate, 1000);
    deepStrictEqual(result[0].stats, { Distance: 5000 });
    strictEqual(result[0].activities.length, 1);
    strictEqual(result[0].activities[0].id, 'a1');
    deepStrictEqual(result[0].activities[0].stats, { Duration: 300 });
  });

  it('enriches multiple events', async () => {
    const eventRows = [
      {
        id: 'e1',
        start_date: 1000,
        name: 'E1',
        end_date: null,
        description: null,
        is_merge: 0,
        src_file_type: null,
      },
      {
        id: 'e2',
        start_date: 2000,
        name: 'E2',
        end_date: null,
        description: null,
        is_merge: 0,
        src_file_type: null,
      },
    ];
    const db = {
      query: async (sql) => {
        if (sql.includes('event_stats'))
          return [
            { event_id: 'e1', stat_type: 'Distance', value: 1000 },
            { event_id: 'e2', stat_type: 'Distance', value: 2000 },
          ];
        if (sql.includes('activities') && !sql.includes('activity_stats')) return [];
        return [];
      },
    };
    const result = await enrichEventsWithStatsAndActivities(eventRows, { db, userId: 'u1' });
    strictEqual(result.length, 2);
    deepStrictEqual(result[0].stats, { Distance: 1000 });
    deepStrictEqual(result[1].stats, { Distance: 2000 });
    deepStrictEqual(result[0].activities, []);
    deepStrictEqual(result[1].activities, []);
  });
});

describe('getEventById', () => {
  it('returns null when event not found', async () => {
    const db = { query: async () => [] };
    const result = await getEventById('missing', { db, userId: 'u1' });
    strictEqual(result, null);
  });

  it('returns event with activities when found', async () => {
    const eventRow = {
      id: 'e1',
      start_date: 1000,
      name: 'Run',
      end_date: 2000,
      description: null,
      is_merge: 0,
      src_file_type: 'tcx',
    };
    const activityRows = [
      {
        id: 'a1',
        event_id: 'e1',
        name: 'Lap 1',
        start_date: 1000,
        end_date: 2000,
        type: 'Running',
        device_name: 'Garmin',
      },
    ];
    const db = {
      query: async (sql) => {
        if (sql.includes('FROM events WHERE id = ?') && !sql.includes(' IN ')) return [eventRow];
        if (sql.includes('activities') && !sql.includes('activity_stats')) return activityRows;
        if (sql.includes('event_stats') && sql.includes('event_id = ?'))
          return [{ stat_type: 'Distance', value: 5000 }];
        if (sql.includes('activity_stats'))
          return [{ activity_id: 'a1', stat_type: 'Duration', value: 300 }];
        return [];
      },
    };
    const result = await getEventById('e1', { db, userId: 'u1' });
    strictEqual(result.event.id, 'e1');
    strictEqual(result.event.startDate, 1000);
    deepStrictEqual(result.event.stats, { Distance: 5000 });
    strictEqual(result.activities.length, 1);
    strictEqual(result.activities[0].type, 'Running');
    deepStrictEqual(result.activities[0].stats, { Duration: 300 });
  });
});

describe('listEvents', () => {
  it('returns empty array when no events', async () => {
    const db = { query: async () => [] };
    const result = await listEvents({}, { db, userId: 'u1' });
    deepStrictEqual(result, []);
  });

  it('uses default limit 50 and applies startDate/endDate', async () => {
    const eventRows = [
      {
        id: 'e1',
        start_date: 5000,
        name: 'E',
        end_date: null,
        description: null,
        is_merge: 0,
        src_file_type: null,
      },
    ];
    const db = {
      query: async (sql, params) => {
        if (sql.includes('ORDER BY start_date DESC')) {
          strictEqual(params[params.length - 1], 50, 'default limit 50');
          if (params[1] !== undefined) strictEqual(params[1], 1000, 'startDate filter');
          if (params[2] !== undefined) strictEqual(params[2], 2000, 'endDate filter');
          return eventRows;
        }
        return [];
      },
    };
    const result = await listEvents({ startDate: 1000, endDate: 2000 }, { db, userId: 'u1' });
    strictEqual(result.length, 1);
  });

  it('caps limit at 200', async () => {
    const db = {
      query: async (sql, params) => {
        if (sql.includes('ORDER BY start_date DESC')) {
          strictEqual(params[params.length - 1], 200, 'limit capped at 200');
          return [];
        }
        return [];
      },
    };
    await listEvents({ limit: 999 }, { db, userId: 'u1' });
  });
});

describe('getActivityRows', () => {
  it('returns empty rows and total 0 when no data', async () => {
    const db = { query: async (sql) => (sql.includes('COUNT') ? [{ total: 0 }] : []) };
    const result = await getActivityRows({}, { db, userId: 'u1' });
    deepStrictEqual(result, { rows: [], total: 0 });
  });

  it('returns rows and total with limit/offset', async () => {
    const db = {
      query: async (sql, params) => {
        if (sql.includes('COUNT')) return [{ total: 2 }];
        if (sql.includes('e.id AS event_id, a.id AS activity_id')) {
          return [
            { event_id: 'e1', activity_id: 'a1' },
            { event_id: 'e2', activity_id: 'a2' },
          ];
        }
        if (sql.includes('FROM events') && sql.includes('WHERE id IN')) {
          return [
            {
              id: 'e1',
              start_date: 1000,
              name: 'E1',
              end_date: null,
              description: null,
              is_merge: 0,
              src_file_type: null,
            },
            {
              id: 'e2',
              start_date: 2000,
              name: 'E2',
              end_date: null,
              description: null,
              is_merge: 0,
              src_file_type: null,
            },
          ];
        }
        if (sql.includes('FROM activities a') && sql.includes('WHERE a.id IN')) {
          return [
            {
              id: 'a1',
              event_id: 'e1',
              name: null,
              start_date: 1000,
              end_date: null,
              type: 'Run',
              device_name: null,
            },
            {
              id: 'a2',
              event_id: 'e2',
              name: null,
              start_date: 2000,
              end_date: null,
              type: 'Run',
              device_name: null,
            },
          ];
        }
        if (sql.includes('event_stats')) return [];
        if (sql.includes('activity_stats')) return [];
        return [];
      },
    };
    const result = await getActivityRows({ limit: 10, offset: 0 }, { db, userId: 'u1' });
    strictEqual(result.total, 2);
    strictEqual(result.rows.length, 2);
    strictEqual(result.rows[0].event.id, 'e1');
    strictEqual(result.rows[0].activity.id, 'a1');
  });
});

describe('getComparisonCandidates', () => {
  it('returns null when source event not found', async () => {
    const db = { query: async () => [] };
    const result = await getComparisonCandidates('missing', { db, userId: 'u1' });
    strictEqual(result, null);
  });

  it('returns empty array when no overlapping events', async () => {
    const db = {
      query: async (sql) => {
        if (sql.includes('start_date, end_date') && sql.includes('FROM events WHERE id = ?'))
          return [{ start_date: 1000, end_date: 2000 }];
        return [];
      },
    };
    const result = await getComparisonCandidates('e1', { db, userId: 'u1' });
    deepStrictEqual(result, []);
  });

  it('returns overlapping events with stats and activities', async () => {
    const candidateRows = [
      {
        id: 'e2',
        start_date: 1500,
        name: 'E2',
        end_date: 2500,
        description: null,
        is_merge: 0,
        src_file_type: null,
      },
    ];
    const db = {
      query: async (sql) => {
        if (sql.includes('start_date, end_date') && sql.includes('FROM events WHERE id = ?'))
          return [{ start_date: 1000, end_date: 2000 }];
        if (sql.includes('WHERE id != ?')) return candidateRows;
        if (sql.includes('event_stats'))
          return [{ event_id: 'e2', stat_type: 'Distance', value: 3000 }];
        if (sql.includes('activities') && !sql.includes('activity_stats')) return [];
        return [];
      },
    };
    const result = await getComparisonCandidates('e1', { db, userId: 'u1' });
    strictEqual(result.length, 1);
    strictEqual(result[0].id, 'e2');
    deepStrictEqual(result[0].stats, { Distance: 3000 });
  });
});
