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

module.exports = { ParseError };
