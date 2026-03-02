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

module.exports = { ParseError, ValidationError, NotFoundError };
