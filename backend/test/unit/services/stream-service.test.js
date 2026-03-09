const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const { getStreamsForActivity } = require('../../../src/services/stream-service');

describe('getStreamsForActivity', () => {
  it('returns empty array when no streams', async () => {
    const db = { query: async () => [] };
    const result = await getStreamsForActivity('e1', 'a1', {}, { db, userId: 'u1' });
    deepStrictEqual(result, []);
  });

  it('returns streams with data points ordered by type and sequence', async () => {
    const db = {
      query: async (sql, params) => {
        if (sql.includes('FROM streams')) {
          return [
            { id: 'a1_Heart Rate', type: 'Heart Rate' },
            { id: 'a1_Time', type: 'Time' },
          ];
        }
        if (sql.includes('stream_data_points')) {
          return [
            { stream_id: 'a1_Heart Rate', time_ms: 1000, value: 120, sequence_index: 0 },
            { stream_id: 'a1_Heart Rate', time_ms: 2000, value: 125, sequence_index: 1 },
            { stream_id: 'a1_Time', time_ms: 1000, value: 0, sequence_index: 0 },
            { stream_id: 'a1_Time', time_ms: 2000, value: 1, sequence_index: 1 },
          ];
        }
        return [];
      },
    };
    const result = await getStreamsForActivity('e1', 'a1', {}, { db, userId: 'u1' });
    strictEqual(result.length, 2);
    const hr = result.find((s) => s.type === 'Heart Rate');
    const time = result.find((s) => s.type === 'Time');
    deepStrictEqual(hr.data, [
      { time: 1000, value: 120 },
      { time: 2000, value: 125 },
    ]);
    deepStrictEqual(time.data, [
      { time: 1000, value: 0 },
      { time: 2000, value: 1 },
    ]);
  });

  it('filters by options.types when provided', async () => {
    let capturedParams;
    const db = {
      query: async (sql, params) => {
        if (sql.includes('FROM streams')) {
          capturedParams = params;
          return [{ id: 'a1_Heart Rate', type: 'Heart Rate' }];
        }
        if (sql.includes('stream_data_points')) {
          return [{ stream_id: 'a1_Heart Rate', time_ms: 1000, value: 100, sequence_index: 0 }];
        }
        return [];
      },
    };
    await getStreamsForActivity(
      'e1',
      'a1',
      { types: ['Heart Rate', 'Distance'] },
      { db, userId: 'u1' }
    );
    strictEqual(capturedParams[3], 'Heart Rate');
    strictEqual(capturedParams[4], 'Distance');
  });
});
