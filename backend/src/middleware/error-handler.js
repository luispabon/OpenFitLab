/**
 * Central error handler for async routes. Converts thrown errors (e.g. NotFoundError,
 * ValidationError) into JSON responses with appropriate status codes.
 * CSRF errors (EBADCSRFTOKEN) get a consistent JSON message.
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let message = err && err.message ? err.message : 'Internal server error';
  let statusCode =
    typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;
  if (err && err.code === 'EBADCSRFTOKEN') {
    statusCode = 403;
    message = 'Invalid or missing CSRF token';
  }
  if (
    err &&
    err.name === 'StravaRateLimitError' &&
    typeof err.retryAfterSeconds === 'number' &&
    err.retryAfterSeconds > 0
  ) {
    res.set('Retry-After', String(Math.min(err.retryAfterSeconds, 86400)));
  }
  res.status(statusCode).json({ error: message });
}

module.exports = { errorHandler };
