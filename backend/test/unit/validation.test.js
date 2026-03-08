const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const {
  validateGetEventsQuery,
  validateGetActivityRowsQuery,
  validateEventId,
  validateActivityId,
  validateStreamTypes,
  validateComparisonId,
  validateComparisonBody,
  validateComparisonByEventsBody,
  validateComparisonFolderUpdateBody,
  validateExportQuery,
} = require('../../src/utils/validation');

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
  };
  return res;
}

function mockNext() {
  let called = false;
  const next = () => {
    called = true;
  };
  next.called = () => called;
  return next;
}

describe('validateGetEventsQuery', () => {
  it('calls next when query is valid', () => {
    const req = { query: {} };
    const res = mockRes();
    const next = mockNext();
    validateGetEventsQuery(req, res, next);
    strictEqual(res.statusCode, null);
    strictEqual(next.called(), true);
  });

  it('returns 400 for invalid startDate', () => {
    const req = { query: { startDate: 'abc' } };
    const res = mockRes();
    const next = mockNext();
    validateGetEventsQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'startDate must be a non-negative number' });
    strictEqual(next.called(), false);
  });

  it('returns 400 for invalid endDate', () => {
    const req = { query: { endDate: -1 } };
    const res = mockRes();
    const next = mockNext();
    validateGetEventsQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'endDate must be a non-negative number' });
    strictEqual(next.called(), false);
  });

  it('returns 400 for invalid limit', () => {
    const req = { query: { limit: 'zero' } };
    const res = mockRes();
    const next = mockNext();
    validateGetEventsQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'limit must be a positive integer' });
    strictEqual(next.called(), false);
  });

  it('returns 400 when limit exceeds 200', () => {
    const req = { query: { limit: 201 } };
    const res = mockRes();
    const next = mockNext();
    validateGetEventsQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'limit must not exceed 200' });
    strictEqual(next.called(), false);
  });

  it('calls next when startDate, endDate, limit are valid', () => {
    const req = { query: { startDate: 0, endDate: 9999999999999, limit: 10 } };
    const res = mockRes();
    const next = mockNext();
    validateGetEventsQuery(req, res, next);
    strictEqual(res.statusCode, null);
    strictEqual(next.called(), true);
  });

  it('calls next when limit is 200 (max allowed)', () => {
    const req = { query: { limit: 200 } };
    const res = mockRes();
    const next = mockNext();
    validateGetEventsQuery(req, res, next);
    strictEqual(res.statusCode, null);
    strictEqual(next.called(), true);
  });
});

describe('validateGetActivityRowsQuery', () => {
  it('calls next when query is valid', () => {
    const req = { query: {} };
    const res = mockRes();
    const next = mockNext();
    validateGetActivityRowsQuery(req, res, next);
    strictEqual(next.called(), true);
  });

  it('returns 400 for limit out of range (0)', () => {
    const req = { query: { limit: 0 } };
    const res = mockRes();
    const next = mockNext();
    validateGetActivityRowsQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'limit must be an integer between 1 and 50' });
    strictEqual(next.called(), false);
  });

  it('returns 400 for limit > 50', () => {
    const req = { query: { limit: 51 } };
    const res = mockRes();
    const next = mockNext();
    validateGetActivityRowsQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    strictEqual(next.called(), false);
  });

  it('returns 400 for invalid offset', () => {
    const req = { query: { offset: -1 } };
    const res = mockRes();
    const next = mockNext();
    validateGetActivityRowsQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'offset must be a non-negative integer' });
    strictEqual(next.called(), false);
  });

  it('returns 400 for invalid startDate', () => {
    const req = { query: { startDate: 'x' } };
    const res = mockRes();
    const next = mockNext();
    validateGetActivityRowsQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'startDate must be a non-negative number' });
    strictEqual(next.called(), false);
  });

  it('returns 400 for invalid endDate', () => {
    const req = { query: { endDate: NaN } };
    const res = mockRes();
    const next = mockNext();
    validateGetActivityRowsQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'endDate must be a non-negative number' });
    strictEqual(next.called(), false);
  });

  it('returns 400 for empty activityTypes string', () => {
    const req = { query: { activityTypes: '   ' } };
    const res = mockRes();
    const next = mockNext();
    validateGetActivityRowsQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'activityTypes must be non-empty strings' });
    strictEqual(next.called(), false);
  });

  it('returns 400 for empty devices string', () => {
    const req = { query: { devices: '' } };
    const res = mockRes();
    const next = mockNext();
    validateGetActivityRowsQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'devices must be non-empty strings' });
    strictEqual(next.called(), false);
  });

  it('returns 400 when search is not a string', () => {
    const req = { query: { search: 123 } };
    const res = mockRes();
    const next = mockNext();
    validateGetActivityRowsQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'search must be a string' });
    strictEqual(next.called(), false);
  });

  it('calls next when limit, offset, startDate, endDate, activityTypes, devices, search are valid', () => {
    const req = {
      query: {
        limit: 20,
        offset: 0,
        startDate: 0,
        endDate: 1e12,
        activityTypes: 'Running',
        devices: 'Garmin',
        search: 'morning',
      },
    };
    const res = mockRes();
    const next = mockNext();
    validateGetActivityRowsQuery(req, res, next);
    strictEqual(res.statusCode, null);
    strictEqual(next.called(), true);
  });
});

describe('validateEventId', () => {
  it('calls next for valid UUID', () => {
    const req = { params: { id: 'a1b2c3d4-e5f6-4789-a012-3456789abcde' } };
    const res = mockRes();
    const next = mockNext();
    validateEventId(req, res, next);
    strictEqual(res.statusCode, null);
    strictEqual(next.called(), true);
  });

  it('returns 400 for invalid event ID format', () => {
    const req = { params: { id: 'not-a-uuid' } };
    const res = mockRes();
    const next = mockNext();
    validateEventId(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'Invalid event ID format' });
    strictEqual(next.called(), false);
  });
});

describe('validateActivityId', () => {
  it('calls next for valid UUID', () => {
    const req = { params: { activityId: 'f1e2d3c4-b5a6-4789-0123-456789abcdef' } };
    const res = mockRes();
    const next = mockNext();
    validateActivityId(req, res, next);
    strictEqual(next.called(), true);
  });

  it('returns 400 for invalid activity ID format', () => {
    const req = { params: { activityId: 'x' } };
    const res = mockRes();
    const next = mockNext();
    validateActivityId(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'Invalid activity ID format' });
    strictEqual(next.called(), false);
  });
});

describe('validateStreamTypes', () => {
  it('calls next when types not provided', () => {
    const req = { query: {} };
    const res = mockRes();
    const next = mockNext();
    validateStreamTypes(req, res, next);
    strictEqual(next.called(), true);
  });

  it('returns 400 for empty string in types', () => {
    const req = { query: { types: ['Heart Rate', '  '] } };
    const res = mockRes();
    const next = mockNext();
    validateStreamTypes(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'Stream types must be non-empty strings' });
    strictEqual(next.called(), false);
  });

  it('calls next for valid non-empty types', () => {
    const req = { query: { types: ['Heart Rate', 'Distance'] } };
    const res = mockRes();
    const next = mockNext();
    validateStreamTypes(req, res, next);
    strictEqual(next.called(), true);
  });
});

describe('validateComparisonId', () => {
  it('calls next for valid UUID', () => {
    const req = { params: { id: '11111111-2222-3333-4444-555555555555' } };
    const res = mockRes();
    const next = mockNext();
    validateComparisonId(req, res, next);
    strictEqual(next.called(), true);
  });

  it('returns 400 for invalid comparison ID', () => {
    const req = { params: { id: 'invalid' } };
    const res = mockRes();
    const next = mockNext();
    validateComparisonId(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'Invalid comparison ID format' });
    strictEqual(next.called(), false);
  });
});

describe('validateComparisonBody', () => {
  it('calls next for valid body', () => {
    const req = {
      body: {
        name: 'My Comparison',
        activityIds: [
          'a1b2c3d4-e5f6-4789-a012-3456789abcde',
          'b2c3d4e5-f6a7-4890-b123-456789abcdef',
        ],
      },
    };
    const res = mockRes();
    const next = mockNext();
    validateComparisonBody(req, res, next);
    strictEqual(next.called(), true);
  });

  it('returns 400 when name is empty', () => {
    const req = {
      body: {
        name: '',
        activityIds: [
          'a1b2c3d4-e5f6-4789-a012-3456789abcde',
          'b2c3d4e5-f6a7-4890-b123-456789abcdef',
        ],
      },
    };
    const res = mockRes();
    const next = mockNext();
    validateComparisonBody(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'name must be a non-empty string' });
    strictEqual(next.called(), false);
  });

  it('returns 400 when eventIds has fewer than 2 elements', () => {
    const req = { body: { name: 'Compare', activityIds: ['a1b2c3d4-e5f6-4789-a012-3456789abcde'] } };
    const res = mockRes();
    const next = mockNext();
    validateComparisonBody(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, {
      error: 'activityIds must be an array with at least 2 activity IDs',
    });
    strictEqual(next.called(), false);
  });

  it('returns 400 when an eventId is invalid UUID', () => {
    const req = {
      body: {
        name: 'Compare',
        activityIds: ['a1b2c3d4-e5f6-4789-a012-3456789abcde', 'not-a-uuid'],
      },
    };
    const res = mockRes();
    const next = mockNext();
    validateComparisonBody(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'All activityIds must be valid UUIDs' });
    strictEqual(next.called(), false);
  });
});

describe('validateComparisonByEventsBody', () => {
  it('calls next for valid body', () => {
    const req = {
      body: {
        eventIds: ['a1b2c3d4-e5f6-4789-a012-3456789abcde'],
      },
    };
    const res = mockRes();
    const next = mockNext();
    validateComparisonByEventsBody(req, res, next);
    strictEqual(next.called(), true);
  });

  it('returns 400 when eventIds is not an array', () => {
    const req = { body: { eventIds: 'a1b2c3d4-e5f6-4789-a012-3456789abcde' } };
    const res = mockRes();
    const next = mockNext();
    validateComparisonByEventsBody(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'eventIds must be a non-empty array' });
    strictEqual(next.called(), false);
  });

  it('returns 400 when eventIds is empty array', () => {
    const req = { body: { eventIds: [] } };
    const res = mockRes();
    const next = mockNext();
    validateComparisonByEventsBody(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'eventIds must be a non-empty array' });
    strictEqual(next.called(), false);
  });

  it('returns 400 when an eventId is invalid UUID', () => {
    const req = {
      body: {
        eventIds: ['a1b2c3d4-e5f6-4789-a012-3456789abcde', 'not-a-uuid'],
      },
    };
    const res = mockRes();
    const next = mockNext();
    validateComparisonByEventsBody(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'All eventIds must be valid UUIDs' });
    strictEqual(next.called(), false);
  });
});

describe('validateComparisonFolderUpdateBody', () => {
  it('calls next for valid folderId (UUID)', () => {
    const req = {
      body: { folderId: 'a1b2c3d4-e5f6-4789-a012-3456789abcde' },
    };
    const res = mockRes();
    const next = mockNext();
    validateComparisonFolderUpdateBody(req, res, next);
    strictEqual(next.called(), true);
  });

  it('calls next for folderId null (unfiled)', () => {
    const req = { body: { folderId: null } };
    const res = mockRes();
    const next = mockNext();
    validateComparisonFolderUpdateBody(req, res, next);
    strictEqual(next.called(), true);
  });

  it('returns 400 when folderId is missing', () => {
    const req = { body: {} };
    const res = mockRes();
    const next = mockNext();
    validateComparisonFolderUpdateBody(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'folderId is required' });
    strictEqual(next.called(), false);
  });

  it('returns 400 when folderId is not a valid UUID', () => {
    const req = { body: { folderId: 'not-a-uuid' } };
    const res = mockRes();
    const next = mockNext();
    validateComparisonFolderUpdateBody(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'folderId must be a valid UUID or null' });
    strictEqual(next.called(), false);
  });
});

describe('validateExportQuery', () => {
  it('calls next when includeStreams is "true"', () => {
    const req = { query: { includeStreams: 'true' } };
    const res = mockRes();
    const next = mockNext();
    validateExportQuery(req, res, next);
    strictEqual(res.statusCode, null);
    strictEqual(next.called(), true);
  });

  it('calls next when includeStreams is "false"', () => {
    const req = { query: { includeStreams: 'false' } };
    const res = mockRes();
    const next = mockNext();
    validateExportQuery(req, res, next);
    strictEqual(res.statusCode, null);
    strictEqual(next.called(), true);
  });

  it('calls next when includeStreams is not provided', () => {
    const req = { query: {} };
    const res = mockRes();
    const next = mockNext();
    validateExportQuery(req, res, next);
    strictEqual(res.statusCode, null);
    strictEqual(next.called(), true);
  });

  it('returns 400 when includeStreams is "yes"', () => {
    const req = { query: { includeStreams: 'yes' } };
    const res = mockRes();
    const next = mockNext();
    validateExportQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'includeStreams must be "true" or "false"' });
    strictEqual(next.called(), false);
  });

  it('returns 400 when includeStreams is 1', () => {
    const req = { query: { includeStreams: 1 } };
    const res = mockRes();
    const next = mockNext();
    validateExportQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'includeStreams must be "true" or "false"' });
    strictEqual(next.called(), false);
  });

  it('returns 400 when includeStreams is empty string', () => {
    const req = { query: { includeStreams: '' } };
    const res = mockRes();
    const next = mockNext();
    validateExportQuery(req, res, next);
    strictEqual(res.statusCode, 400);
    deepStrictEqual(res.body, { error: 'includeStreams must be "true" or "false"' });
    strictEqual(next.called(), false);
  });
});
