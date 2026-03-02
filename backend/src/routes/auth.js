const express = require('express');
const passport = require('passport');
const { asyncHandler } = require('../middleware/async-handler');
const config = require('../config');
const { ValidationError } = require('../errors');
const userRepository = require('../repositories/user-repository');

const router = express.Router();

/**
 * Helper to check if an OAuth strategy is enabled
 */
function isEnabled(strategy) {
  if (strategy === 'google') return config.oauth.google.enabled;
  if (strategy === 'github') return config.oauth.github.enabled;
  return false;
}

// Google OAuth
router.get('/google', (req, res, next) => {
  if (!isEnabled('google')) {
    throw new ValidationError(
      'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env'
    );
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get(
  '/google/callback',
  (req, res, next) => {
    if (!isEnabled('google')) return res.status(404).end();
    passport.authenticate('google', { failureRedirect: '/#/login?error=google' })(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    req.session.userId = userId;
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    // In development, redirect back to port 4200 if we started there
    res.redirect(`${config.server.oauthRedirectBase}/#/?login=success`);
  })
);

// GitHub OAuth
router.get('/github', (req, res, next) => {
  if (!isEnabled('github')) {
    throw new ValidationError(
      'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env'
    );
  }
  passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

router.get(
  '/github/callback',
  (req, res, next) => {
    if (!isEnabled('github')) return res.status(404).end();
    passport.authenticate('github', { failureRedirect: '/#/login?error=github' })(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    req.session.userId = userId;
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    res.redirect(`${config.server.oauthRedirectBase}/#/?login=success`);
  })
);

// GET /api/auth/me — return current user or 401
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await userRepository.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'User not found' });
    }
    res.json({
      id: user.id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    });
  })
);

// POST /api/auth/logout — destroy session
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    res.clearCookie('ofl.sid', { path: '/' });
    res.json({ ok: true });
  })
);

module.exports = router;
