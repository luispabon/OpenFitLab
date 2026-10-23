const { UnsupportedMediaTypeError } = require('../errors');

/**
 * Rejects requests whose Content-Encoding is anything other than identity (or absent).
 * Request bodies are never decompressed, so compressed bodies get 415 before any parser runs.
 */
function rejectContentEncoding(req, _res, next) {
  const header = req.headers['content-encoding'];
  if (!header) return next();
  const encodings = header.split(',').map((token) => token.trim().toLowerCase());
  if (encodings.every((token) => token === 'identity')) return next();
  return next(new UnsupportedMediaTypeError('Unsupported Content-Encoding'));
}

module.exports = { rejectContentEncoding };
