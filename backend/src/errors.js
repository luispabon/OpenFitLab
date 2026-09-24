/**
 * ParseError indicates a file parse failure (e.g. invalid format, corrupt file).
 * Central error handler maps this to HTTP 400.
 */
class ParseError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ParseError';
    this.statusCode = 400;
  }
}

class ValidationError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

/** Content-Length header required for multipart uploads (chunked uploads not supported). */
class LengthRequiredError extends Error {
  constructor(message = 'Content-Length header is required', options = {}) {
    super(message, options);
    this.name = 'LengthRequiredError';
    this.statusCode = 411;
  }
}

/** Upload exceeds a configured size limit (aggregate request, per-file, or multer parts/fields). */
class PayloadTooLargeError extends Error {
  constructor(message = 'Payload too large', options = {}) {
    super(message, options);
    this.name = 'PayloadTooLargeError';
    this.statusCode = 413;
  }
}

/** Per-user upload concurrency limit exceeded. */
class TooManyUploadsError extends Error {
  constructor(message = 'Too many concurrent uploads, please try again shortly.', options = {}) {
    super(message, options);
    this.name = 'TooManyUploadsError';
    this.statusCode = 429;
  }
}

/** Strava OAuth access token rejected or expired (reconnect required). */
class StravaTokenExpiredError extends Error {
  constructor(message = 'Strava connection expired. Please reconnect.') {
    super(message);
    this.name = 'StravaTokenExpiredError';
    this.statusCode = 401;
  }
}

/** Strava API rate limit (429). */
class StravaRateLimitError extends Error {
  constructor(retryAfterSeconds = null) {
    super('Strava is temporarily limiting requests. Please try again in a few minutes.');
    this.name = 'StravaRateLimitError';
    this.statusCode = 429;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Unexpected Strava API failure after retries. */
class StravaUpstreamError extends Error {
  constructor(message = 'Strava request failed') {
    super(message);
    this.name = 'StravaUpstreamError';
    this.statusCode = 502;
  }
}

module.exports = {
  ParseError,
  ValidationError,
  NotFoundError,
  LengthRequiredError,
  PayloadTooLargeError,
  TooManyUploadsError,
  StravaTokenExpiredError,
  StravaRateLimitError,
  StravaUpstreamError,
};
