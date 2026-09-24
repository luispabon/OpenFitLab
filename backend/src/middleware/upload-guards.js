const multer = require('multer');
const {
  LengthRequiredError,
  PayloadTooLargeError,
  TooManyUploadsError,
  ValidationError,
} = require('../errors');
const config = require('../config');

const PAYLOAD_TOO_LARGE_MULTER_CODES = new Set([
  'LIMIT_FILE_SIZE',
  'LIMIT_FILE_COUNT',
  'LIMIT_PART_COUNT',
  'LIMIT_FIELD_KEY',
  'LIMIT_FIELD_VALUE',
  'LIMIT_FIELD_COUNT',
]);

/**
 * Maps a multer error to a typed error with a statusCode: 413 for size/count limits
 * (LIMIT_FILE_SIZE, LIMIT_FILE_COUNT, etc.), 400 for anything else (e.g. LIMIT_UNEXPECTED_FILE).
 * Non-multer errors are returned unchanged.
 */
function mapMulterError(err) {
  if (!(err instanceof multer.MulterError)) return err;
  if (PAYLOAD_TOO_LARGE_MULTER_CODES.has(err.code)) {
    return new PayloadTooLargeError(err.message);
  }
  return new ValidationError(err.message);
}

/**
 * Rejects multipart upload requests whose Content-Length exceeds the configured aggregate
 * cap, before multer buffers anything. Multipart requests must send Content-Length (chunked
 * transfer encoding is not supported for uploads).
 */
function createContentLengthGuard({ maxBytes = config.upload.maxRequestBytes } = {}) {
  return function contentLengthGuard(req, res, next) {
    if (!req.is('multipart/form-data')) return next();

    const contentLength = req.headers['content-length'];
    if (contentLength == null) {
      return next(new LengthRequiredError());
    }
    const bytes = Number(contentLength);
    if (!Number.isFinite(bytes) || bytes < 0) {
      return next(new LengthRequiredError('Invalid Content-Length header'));
    }
    if (bytes > maxBytes) {
      return next(new PayloadTooLargeError('Upload exceeds maximum allowed size'));
    }
    next();
  };
}

/**
 * Limits in-flight upload requests per authenticated user (req.userId) for this process, to
 * bound memory used by multer buffering across concurrent requests. Must run before multer
 * so buffers are never allocated for rejected requests. Counters are released exactly once,
 * whether the response finishes normally or the connection closes early.
 */
function createUploadConcurrencyGuard({ maxPerUser = config.upload.maxConcurrentPerUser } = {}) {
  const inFlight = new Map();

  return function uploadConcurrencyGuard(req, res, next) {
    const userId = req.userId;
    const current = inFlight.get(userId) ?? 0;
    if (current >= maxPerUser) {
      return next(new TooManyUploadsError());
    }
    inFlight.set(userId, current + 1);

    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const count = inFlight.get(userId);
      if (count <= 1) {
        inFlight.delete(userId);
      } else {
        inFlight.set(userId, count - 1);
      }
    };
    res.on('finish', release);
    res.on('close', release);

    next();
  };
}

module.exports = { createContentLengthGuard, createUploadConcurrencyGuard, mapMulterError };
