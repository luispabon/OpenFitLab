const express = require('express');
const passport = require('passport');
const { asyncHandler } = require('../middleware/async-handler');

const router = express.Router();

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/#/login?error=google' }),
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
    res.redirect('/#/?login=success');
  })
);

// GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: '/#/login?error=github' }),
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
    res.redirect('/#/?login=success');
  })
);

// GET /api/auth/me — return current user or 401
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const userRepository = require('../repositories/user-repository');
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
