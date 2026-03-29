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
  StravaTokenExpiredError,
  StravaRateLimitError,
  StravaUpstreamError,
};
