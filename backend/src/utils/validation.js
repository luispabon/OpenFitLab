/**
 * Validates UUID format
 */
function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return typeof str === 'string' && uuidRegex.test(str);
}

/**
 * Validates that a value is a positive integer
 */
function isPositiveInteger(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0;
}

/**
 * Validates that a value is a non-negative number (for timestamps)
 */
function isNonNegativeNumber(value) {
  const num = Number(value);
  return !Number.isNaN(num) && num >= 0;
}

/**
 * Validates that a value is a non-negative integer (for offset)
 */
function isNonNegativeInteger(value) {
  const num = Number(value);
  return Number.isInteger(num) && !Number.isNaN(num) && num >= 0;
}

/**
 * Validates query parameters for GET /api/events
 */
function validateGetEventsQuery(req, res, next) {
  const { startDate, endDate, limit } = req.query;

  if (startDate != null && !isNonNegativeNumber(startDate)) {
    return res.status(400).json({ error: 'startDate must be a non-negative number' });
  }

  if (endDate != null && !isNonNegativeNumber(endDate)) {
    return res.status(400).json({ error: 'endDate must be a non-negative number' });
  }

  if (limit != null) {
    if (!isPositiveInteger(limit)) {
      return res.status(400).json({ error: 'limit must be a positive integer' });
    }
    const limitNum = Number(limit);
    if (limitNum > 200) {
      return res.status(400).json({ error: 'limit must not exceed 200' });
    }
  }

  next();
}

/**
 * Validates query parameters for GET /api/events/activity-rows
 */
function validateGetActivityRowsQuery(req, res, next) {
  const { limit, offset, startDate, endDate, activityTypes, devices, search } = req.query;

  if (limit != null) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      return res.status(400).json({ error: 'limit must be an integer between 1 and 50' });
    }
  }

  if (offset != null && !isNonNegativeInteger(offset)) {
    return res.status(400).json({ error: 'offset must be a non-negative integer' });
  }

  if (startDate != null && !isNonNegativeNumber(startDate)) {
    return res.status(400).json({ error: 'startDate must be a non-negative number' });
  }

  if (endDate != null && !isNonNegativeNumber(endDate)) {
    return res.status(400).json({ error: 'endDate must be a non-negative number' });
  }

  if (activityTypes != null) {
    const arr = Array.isArray(activityTypes) ? activityTypes : [activityTypes];
    for (const t of arr) {
      if (typeof t !== 'string' || t.trim().length === 0) {
        return res.status(400).json({ error: 'activityTypes must be non-empty strings' });
      }
    }
  }

  if (devices != null) {
    const arr = Array.isArray(devices) ? devices : [devices];
    for (const d of arr) {
      if (typeof d !== 'string' || d.trim().length === 0) {
        return res.status(400).json({ error: 'devices must be non-empty strings' });
      }
    }
  }

  if (search != null && typeof search !== 'string') {
    return res.status(400).json({ error: 'search must be a string' });
  }

  next();
}

/**
 * Validates event ID parameter
 */
function validateEventId(req, res, next) {
  const { id } = req.params;
  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid event ID format' });
  }
  next();
}

/**
 * Validates activity ID parameter
 */
function validateActivityId(req, res, next) {
  const { activityId } = req.params;
  if (!isValidUUID(activityId)) {
    return res.status(400).json({ error: 'Invalid activity ID format' });
  }
  next();
}

/**
 * Validates stream types query parameter
 */
function validateStreamTypes(req, res, next) {
  const { types } = req.query;
  if (types != null) {
    const typeArray = Array.isArray(types) ? types : [types];
    for (const type of typeArray) {
      if (typeof type !== 'string' || type.trim().length === 0) {
        return res.status(400).json({ error: 'Stream types must be non-empty strings' });
      }
    }
  }
  next();
}

/**
 * Validates comparison ID parameter
 */
function validateComparisonId(req, res, next) {
  const { id } = req.params;
  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Invalid comparison ID format' });
  }
  next();
}

/**
 * Validates comparison body for POST /api/comparisons
 */
function validateComparisonBody(req, res, next) {
  const { name, activityIds } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name must be a non-empty string' });
  }

  if (!Array.isArray(activityIds) || activityIds.length < 2) {
    return res
      .status(400)
      .json({ error: 'activityIds must be an array with at least 2 activity IDs' });
  }

  for (const activityId of activityIds) {
    if (!isValidUUID(activityId)) {
      return res.status(400).json({ error: 'All activityIds must be valid UUIDs' });
    }
  }

  next();
}

/**
 * Validates body for POST /api/comparisons/by-events
 */
function validateComparisonByEventsBody(req, res, next) {
  const { eventIds } = req.body;

  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return res.status(400).json({ error: 'eventIds must be a non-empty array' });
  }

  for (const eventId of eventIds) {
    if (!isValidUUID(eventId)) {
      return res.status(400).json({ error: 'All eventIds must be valid UUIDs' });
    }
  }

  next();
}

/**
 * Validates query parameters for GET /api/account/export
 */
function validateExportQuery(req, res, next) {
  const { includeStreams } = req.query;
  if (includeStreams != null && includeStreams !== 'true' && includeStreams !== 'false') {
    return res.status(400).json({ error: 'includeStreams must be "true" or "false"' });
  }
  next();
}

module.exports = {
  validateGetEventsQuery,
  validateGetActivityRowsQuery,
  validateEventId,
  validateActivityId,
  validateStreamTypes,
  validateComparisonId,
  validateComparisonBody,
  validateComparisonByEventsBody,
  validateExportQuery,
};
