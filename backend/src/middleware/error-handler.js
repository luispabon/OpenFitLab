const {
  ParseError,
  ValidationError,
  NotFoundError,
  LengthRequiredError,
  PayloadTooLargeError,
  TooManyUploadsError,
  StravaTokenExpiredError,
  StravaRateLimitError,
  StravaUpstreamError,
} = require('../errors');

/**
 * Errors whose messages are intentional, validated, or otherwise public-safe. Only these
 * carry their own text to the client; any other error message is replaced with a fixed one.
 */
const PUBLIC_ERROR_TYPES = [
  ParseError,
  ValidationError,
  NotFoundError,
  LengthRequiredError,
  PayloadTooLargeError,
  TooManyUploadsError,
  StravaTokenExpiredError,
  StravaRateLimitError,
  StravaUpstreamError,
];

function isPublicError(err) {
  return PUBLIC_ERROR_TYPES.some((type) => err instanceof type);
}

/**
 * Central error handler for async routes. Converts thrown errors (e.g. NotFoundError,
 * ValidationError) into JSON responses with appropriate status codes.
 * CSRF errors (EBADCSRFTOKEN) get a consistent JSON message.
 * Only allowlisted public error types keep their own message; other 4xx/5xx errors use a
 * fixed message so unexpected details are never reflected to the client.
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  let message = err && err.message ? err.message : 'Internal server error';
  let statusCode =
    typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;
  const isCsrfError = Boolean(err && err.code === 'EBADCSRFTOKEN');
  if (isCsrfError) {
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
  if (!isCsrfError && !isPublicError(err)) {
    message = statusCode >= 500 ? 'Internal server error' : 'Bad request';
  }
  res.status(statusCode).json({ error: message });
}

module.exports = { errorHandler };
