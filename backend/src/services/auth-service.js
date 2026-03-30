const config = require('../config');
const { ValidationError } = require('../errors');
const userRepository = require('../repositories/user-repository');
const defaultDb = require('../db');

function integrationsCapabilities() {
  return {
    providers: {
      strava: { configured: config.integrations.strava.enabled },
    },
  };
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/**
 * After Passport OAuth callback: establish session and return SPA redirect URL.
 * @param {import('express').Request} req
 * @returns {Promise<string>}
 */
async function handleOAuthCallback(req) {
  if (req.user.pendingSignup) {
    await regenerateSession(req);
    req.session.pendingSignup = req.user.profile;
    req.session.cookie.maxAge = config.termsOfService.pendingSignupExpiryMs;
    await saveSession(req);
    return `${config.server.oauthRedirectBase}/#/?signup=pending`;
  }
  const userId = req.user.user.id;
  await regenerateSession(req);
  req.session.userId = userId;
  await saveSession(req);
  return `${config.server.oauthRedirectBase}/#/?login=success`;
}

function buildPendingSignupMeResponse(req) {
  return {
    pendingSignup: true,
    profile: {
      displayName: req.session.pendingSignup.displayName ?? null,
      avatarUrl: req.session.pendingSignup.avatarUrl ?? null,
    },
    integrations: integrationsCapabilities(),
    csrfToken: req.csrfToken(),
  };
}

/**
 * @param {string} userId
 * @param {{ db?: object }} [opts]
 * @returns {Promise<{ id: string, displayName: string | null, avatarUrl: string | null } | null>}
 */
async function getCurrentUserForMe(userId, opts = {}) {
  const db = opts.db ?? defaultDb;
  const user = await userRepository.findById(userId, { db });
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
  };
}

/**
 * Create user from pending OAuth profile and attach to session.
 * @param {import('express').Request} req
 * @param {{ db?: object }} [opts]
 * @returns {Promise<{ id: string, displayName: string | null, avatarUrl: string | null }>}
 */
async function completeSignup(req, opts = {}) {
  const pendingProfile = req.session?.pendingSignup;
  if (!pendingProfile) {
    throw new ValidationError('No pending signup found. Please sign in again.');
  }
  const db = opts.db ?? defaultDb;
  const result = await userRepository.createFromPendingProfile(pendingProfile, { db });
  delete req.session.pendingSignup;
  req.session.userId = result.user.id;
  req.session.cookie.maxAge = config.termsOfService.normalSessionExpiryMs;
  await saveSession(req);
  return {
    id: result.user.id,
    displayName: result.user.display_name,
    avatarUrl: result.user.avatar_url,
  };
}

module.exports = {
  integrationsCapabilities,
  regenerateSession,
  saveSession,
  destroySession,
  handleOAuthCallback,
  buildPendingSignupMeResponse,
  getCurrentUserForMe,
  completeSignup,
};
