const express = require('express');
const passport = require('passport');
const { asyncHandler } = require('../middleware/async-handler');
const config = require('../config');
const { ValidationError } = require('../errors');
const authService = require('../services/auth-service');

const router = express.Router();

/**
 * Helper to check if an OAuth strategy is enabled
 */
function isEnabled(strategy) {
  if (strategy === 'google') return config.oauth.google.enabled;
  if (strategy === 'github') return config.oauth.github.enabled;
  if (strategy === 'apple') return config.oauth.apple.enabled;
  if (strategy === 'facebook') return config.oauth.facebook.enabled;
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
    if (!isEnabled('google')) return res.status(404).json({ error: 'Not found' });
    passport.authenticate('google', {
      failureRedirect: '/#/login?error=google',
      session: false,
    })(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const redirectUrl = await authService.handleOAuthCallback(req);
    res.redirect(redirectUrl);
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
    if (!isEnabled('github')) return res.status(404).json({ error: 'Not found' });
    passport.authenticate('github', {
      failureRedirect: '/#/login?error=github',
      session: false,
    })(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const redirectUrl = await authService.handleOAuthCallback(req);
    res.redirect(redirectUrl);
  })
);

// Apple OAuth — callback is POST (Apple uses response_mode: form_post)
router.get('/apple', (req, res, next) => {
  if (!isEnabled('apple')) {
    throw new ValidationError(
      'Apple OAuth is not configured. Please set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, and APPLE_PRIVATE_KEY in .env'
    );
  }
  passport.authenticate('apple')(req, res, next);
});

router.post(
  '/apple/callback',
  express.urlencoded({ extended: true }),
  (req, res, next) => {
    if (!isEnabled('apple')) return res.status(404).json({ error: 'Not found' });
    passport.authenticate('apple', {
      failureRedirect: '/#/login?error=apple',
      session: false,
    })(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const redirectUrl = await authService.handleOAuthCallback(req);
    res.redirect(redirectUrl);
  })
);

// Facebook OAuth
router.get('/facebook', (req, res, next) => {
  if (!isEnabled('facebook')) {
    throw new ValidationError(
      'Facebook OAuth is not configured. Please set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET in .env'
    );
  }
  passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
});

router.get(
  '/facebook/callback',
  (req, res, next) => {
    if (!isEnabled('facebook')) return res.status(404).json({ error: 'Not found' });
    passport.authenticate('facebook', {
      failureRedirect: '/#/login?error=facebook',
      session: false,
    })(req, res, next);
  },
  asyncHandler(async (req, res) => {
    const redirectUrl = await authService.handleOAuthCallback(req);
    res.redirect(redirectUrl);
  })
);

// GET /api/auth/me — return current user, pending signup, or 401
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (req.session?.pendingSignup) {
      return res.json(authService.buildPendingSignupMeResponse(req));
    }
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const user = await authService.getCurrentUserForMe(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'User not found' });
    }
    res.json({
      ...user,
      integrations: authService.integrationsCapabilities(),
      csrfToken: req.csrfToken(),
    });
  })
);

// POST /api/auth/logout — destroy session
router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await authService.destroySession(req);
    res.clearCookie('ofl.sid', { path: '/' });
    res.json({ ok: true });
  })
);

// POST /api/auth/complete-signup — accept ToS and create user from pending profile
router.post(
  '/complete-signup',
  asyncHandler(async (req, res) => {
    const user = await authService.completeSignup(req);
    res.status(201).json({
      ...user,
      integrations: authService.integrationsCapabilities(),
      csrfToken: req.csrfToken(),
    });
  })
);

// POST /api/auth/decline-signup — decline ToS, destroy session
router.post(
  '/decline-signup',
  asyncHandler(async (req, res) => {
    await authService.destroySession(req);
    res.clearCookie('ofl.sid', { path: '/' });
    res.json({ ok: true });
  })
);

module.exports = router;
