const { rateLimit } = require('express-rate-limit');
const config = require('../config');

/**
 * Global API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.api.windowMs,
  max: config.rateLimit.api.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Auth rate limiter (login initiation)
 */
const authLimiter = rateLimit({
  windowMs: config.rateLimit.auth.windowMs,
  max: config.rateLimit.auth.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again after 15 minutes.' },
});

/**
 * OAuth callback rate limiter (slightly higher because automated)
 */
const callbackLimiter = rateLimit({
  windowMs: config.rateLimit.authCallback.windowMs,
  max: config.rateLimit.authCallback.max,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Upload rate limiter
 */
const uploadLimiter = rateLimit({
  windowMs: config.rateLimit.upload.windowMs,
  max: config.rateLimit.upload.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached, please try again later.' },
});

module.exports = {
  apiLimiter,
  authLimiter,
  callbackLimiter,
  uploadLimiter,
};
