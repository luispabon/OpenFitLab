/**
 * Wraps an async route handler so rejections are passed to Express error middleware.
 * @param {function(req, res, next): Promise<void>} fn - Async route handler
 * @returns {function(req, res, next)} Express middleware
 */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
