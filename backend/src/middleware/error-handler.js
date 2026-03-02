/**
 * Central error handler for async routes. Converts thrown errors (e.g. NotFoundError,
 * ValidationError) into JSON responses with appropriate status codes.
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const message = err && err.message ? err.message : 'Internal server error';
  const statusCode =
    typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;
  res.status(statusCode).json({ error: message });
}

module.exports = { errorHandler };
