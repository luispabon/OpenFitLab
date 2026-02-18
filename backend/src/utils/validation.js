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

  if (limit != null && !isPositiveInteger(limit)) {
    return res.status(400).json({ error: 'limit must be a positive integer' });
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

module.exports = {
  isValidUUID,
  isPositiveInteger,
  isNonNegativeNumber,
  validateGetEventsQuery,
  validateEventId,
  validateActivityId,
  validateStreamTypes,
};
