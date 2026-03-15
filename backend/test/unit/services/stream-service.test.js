const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const { getStreamsForActivity } = require('../../../src/services/stream-service');

describe('getStreamsForActivity', () => {
  it('returns empty array when no streams', async () => {
    const db = { query: async () => [] };
    const result = await getStreamsForActivity('e1', 'a1', {}, { db, userId: 'u1' });
    deepStrictEqual(result, []);
  });

  it('returns streams with data from packed data column', async () => {
    const db = {
      query: async (sql, params) => {
        if (sql.includes('FROM streams')) {
          return [
            {
              id: 'a1_Heart Rate',
              type: 'Heart Rate',
              data: JSON.stringify([
                { time: 1000, value: 120 },
                { time: 2000, value: 125 },
              ]),
            },
            {
              id: 'a1_Distance',
              type: 'Distance',
              data: JSON.stringify([
                { time: 1000, value: 0 },
                { time: 2000, value: 50 },
              ]),
            },
          ];
        }
        return [];
      },
    };
    const result = await getStreamsForActivity('e1', 'a1', {}, { db, userId: 'u1' });
    strictEqual(result.length, 2);
    const hr = result.find((s) => s.type === 'Heart Rate');
    const dist = result.find((s) => s.type === 'Distance');
    deepStrictEqual(hr.data, [
      { time: 1000, value: 120 },
      { time: 2000, value: 125 },
    ]);
    deepStrictEqual(dist.data, [
      { time: 1000, value: 0 },
      { time: 2000, value: 50 },
    ]);
  });

  it('filters by options.types when provided', async () => {
    let capturedParams;
    const db = {
      query: async (sql, params) => {
        if (sql.includes('FROM streams')) {
          capturedParams = params;
          return [
            {
              id: 'a1_Heart Rate',
              type: 'Heart Rate',
              data: JSON.stringify([{ time: 1000, value: 100 }]),
            },
          ];
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
