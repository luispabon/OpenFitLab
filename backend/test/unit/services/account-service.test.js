const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual, ok } = require('node:assert/strict');
const { exportUserData, deleteAccount } = require('../../../src/services/account-service');
const { makeFakeDb } = require('../../helpers/fake-db');

describe('account-service', () => {
  describe('exportUserData', () => {
    it('returns null when user does not exist', async () => {
      const db = makeFakeDb(async () => []);
      const result = await exportUserData('missing-user', { db });
      strictEqual(result, null);
    });

    it('returns full export with empty data for user with no events', async () => {
      const db = makeFakeDb(async (sql) => {
        if (sql.includes('FROM users WHERE')) {
          return [{ id: 'u1', display_name: 'Alice', avatar_url: null, created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01') }];
        }
        if (sql.includes('FROM user_identities')) {
          return [{ id: 'i1', provider: 'google', provider_user_id: 'g1', email: 'a@b.com', created_at: new Date('2025-01-01') }];
        }
        return [];
      });

      const result = await exportUserData('u1', { db });

      ok(result);
      strictEqual(result.user.id, 'u1');
      strictEqual(result.user.displayName, 'Alice');
      strictEqual(result.identities.length, 1);
      strictEqual(result.identities[0].provider, 'google');
      deepStrictEqual(result.events, []);
      deepStrictEqual(result.eventStats, []);
      deepStrictEqual(result.activities, []);
      deepStrictEqual(result.activityStats, []);
      deepStrictEqual(result.comparisons, []);
      deepStrictEqual(result.comparisonEventActivities, []);
      deepStrictEqual(result.streams, []);
      deepStrictEqual(result.streamDataPoints, []);
    });

    it('returns events, activities, stats, comparisons in batched queries', async () => {
      const db = makeFakeDb(async (sql) => {
        if (sql.includes('FROM users WHERE')) {
          return [{ id: 'u1', display_name: 'Bob', avatar_url: 'http://img', created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01') }];
        }
        if (sql.includes('FROM user_identities')) return [];
        if (sql.includes('FROM events WHERE')) {
          return [{ id: 'e1', start_date: 1000, name: 'Run', end_date: 2000, description: null, is_merge: 0, src_file_type: 'fit', created_at: new Date('2025-01-01') }];
        }
        if (sql.includes('FROM event_stats')) {
          return [{ event_id: 'e1', stat_type: 'distance', value: '100' }];
        }
        if (sql.includes('FROM activities WHERE')) {
          return [{ id: 'a1', event_id: 'e1', name: 'Run', start_date: 1000, end_date: 2000, type: 'running', device_name: 'Garmin', created_at: new Date('2025-01-01') }];
        }
        if (sql.includes('FROM activity_stats')) {
          return [{ activity_id: 'a1', stat_type: 'hr', value: '150' }];
        }
        if (sql.includes('FROM comparisons WHERE')) {
          return [{ id: 'c1', name: 'Comp', settings: '{}', created_at: new Date('2025-01-01') }];
        }
        if (sql.includes('FROM comparison_event_activities')) {
          return [{ comparison_id: 'c1', event_id: 'e1', activity_id: 'a1' }];
        }
        if (sql.includes('FROM streams WHERE')) {
          return [{ id: 's1', activity_id: 'a1', event_id: 'e1', type: 'heartrate', created_at: new Date('2025-01-01') }];
        }
        return [];
      });

      const result = await exportUserData('u1', { db });

      strictEqual(result.events.length, 1);
      strictEqual(result.events[0].id, 'e1');
      strictEqual(result.eventStats.length, 1);
      strictEqual(result.activities.length, 1);
      strictEqual(result.activityStats.length, 1);
      strictEqual(result.comparisons.length, 1);
      strictEqual(result.comparisonEventActivities.length, 1);
      strictEqual(result.streams.length, 1);
      deepStrictEqual(result.streamDataPoints, []);
    });

    it('includes stream data points when includeStreams is true', async () => {
      const db = makeFakeDb(async (sql) => {
        if (sql.includes('FROM users WHERE')) {
          return [{ id: 'u1', display_name: 'X', avatar_url: null, created_at: new Date(), updated_at: new Date() }];
        }
        if (sql.includes('FROM user_identities')) return [];
        if (sql.includes('FROM events WHERE')) {
          return [{ id: 'e1', start_date: 1, name: 'E', end_date: 2, description: null, is_merge: 0, src_file_type: 'fit', created_at: new Date() }];
        }
        if (sql.includes('FROM event_stats')) return [];
        if (sql.includes('FROM activities WHERE')) {
          return [{ id: 'a1', event_id: 'e1', name: 'A', start_date: 1, end_date: 2, type: 'run', device_name: null, created_at: new Date() }];
        }
        if (sql.includes('FROM activity_stats')) return [];
        if (sql.includes('FROM comparisons WHERE')) return [];
        if (sql.includes('FROM streams WHERE')) {
          return [{ id: 's1', activity_id: 'a1', event_id: 'e1', type: 'hr', created_at: new Date() }];
        }
        if (sql.includes('FROM stream_data_points')) {
          return [{ stream_id: 's1', time_ms: 100, value: '72', sequence_index: 0 }];
        }
        return [];
      });

      const result = await exportUserData('u1', { includeStreams: true, db });

      strictEqual(result.streamDataPoints.length, 1);
      strictEqual(result.streamDataPoints[0].stream_id, 's1');
    });

    it('does not include stream data points when includeStreams is false', async () => {
      const db = makeFakeDb(async (sql) => {
        if (sql.includes('FROM users WHERE')) {
          return [{ id: 'u1', display_name: 'X', avatar_url: null, created_at: new Date(), updated_at: new Date() }];
        }
        if (sql.includes('FROM user_identities')) return [];
        if (sql.includes('FROM events WHERE')) {
          return [{ id: 'e1', start_date: 1, name: 'E', end_date: 2, description: null, is_merge: 0, src_file_type: 'fit', created_at: new Date() }];
        }
        if (sql.includes('FROM event_stats')) return [];
        if (sql.includes('FROM activities WHERE')) {
          return [{ id: 'a1', event_id: 'e1', name: 'A', start_date: 1, end_date: 2, type: 'run', device_name: null, created_at: new Date() }];
        }
        if (sql.includes('FROM activity_stats')) return [];
        if (sql.includes('FROM comparisons WHERE')) return [];
        if (sql.includes('FROM streams WHERE')) {
          return [{ id: 's1', activity_id: 'a1', event_id: 'e1', type: 'hr', created_at: new Date() }];
        }
        return [];
      });

      const result = await exportUserData('u1', { includeStreams: false, db });

      deepStrictEqual(result.streamDataPoints, []);
    });
  });

  describe('deleteAccount', () => {
    it('deletes user and returns true on success', async () => {
      const queries = [];
      const db = makeFakeDb(async (sql, params) => {
        queries.push({ sql, params });
        if (sql.includes('DELETE FROM users')) return { affectedRows: 1 };
        return [];
      });

      const result = await deleteAccount('u1', { db });

      strictEqual(result, true);
      ok(queries.some((q) => q.sql.includes('DELETE FROM users')));
    });

    it('returns false when user does not exist', async () => {
      const db = makeFakeDb(async (sql) => {
        if (sql.includes('DELETE FROM users')) return { affectedRows: 0 };
        return [];
      });

      const result = await deleteAccount('missing', { db });

      strictEqual(result, false);
    });
  });
});
