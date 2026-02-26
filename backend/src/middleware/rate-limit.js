const { rateLimit } = require('express-rate-limit');

/**
 * Global API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Auth rate limiter (login initiation)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again after 15 minutes.' },
});

/**
 * OAuth callback rate limiter (slightly higher because automated)
 */
const callbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Upload rate limiter
 */
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 uploads per 15 minutes
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
