const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const userRepository = require('../repositories/user-repository');
const { normalizeEmail } = require('../utils/email');
const config = require('../config');

/**
 * Configures Passport with Google and GitHub OAuth strategies.
 * Strategies are only registered when the corresponding config is enabled.
 */
function configurePassport() {
  passport.serializeUser((user, done) => {
    // Pending signup: do not serialize a user id; auth route stores pendingSignup in session
    if (user && user.pendingSignup === true) {
      return done(null, null);
    }
    // user may be { user, pendingSignup: false } or plain user from deserialize
    const id = user?.user?.id ?? user?.id;
    if (id) done(null, id);
    else done(new Error('Cannot serialize user'), null);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await userRepository.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  const callbackURL = config.oauth.callbackUrl;

  if (config.oauth.google.enabled) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.oauth.google.clientId,
          clientSecret: config.oauth.google.clientSecret,
          callbackURL: `${callbackURL}/api/auth/google/callback`,
          scope: ['profile', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const existingIdentity = await userRepository.findIdentityByProvider(
              'google',
              profile.id
            );
            if (existingIdentity) {
              const user = await userRepository.findById(existingIdentity.user_id);
              done(null, { user, pendingSignup: false });
              return;
            }
            const normalizedEmail = normalizeEmail(profile.emails?.[0]?.value);
            const emailVerified = profile._json?.email_verified === true;
            if (normalizedEmail && emailVerified) {
              const byEmail = await userRepository.findIdentitiesByEmail(normalizedEmail);
              if (byEmail.length === 1) {
                const existingUserId = byEmail[0].user_id;
                await userRepository.linkIdentity(existingUserId, {
                  provider: 'google',
                  providerUserId: profile.id,
                  email: normalizedEmail,
                  displayName: profile.displayName || null,
                  avatarUrl: profile.photos?.[0]?.value || null,
                });
                const user = await userRepository.findById(existingUserId);
                done(null, { user, pendingSignup: false });
                return;
              }
            }
            done(null, {
              pendingSignup: true,
              profile: {
                provider: 'google',
                providerUserId: profile.id,
                displayName: profile.displayName || null,
                avatarUrl: profile.photos?.[0]?.value || null,
                email: normalizedEmail,
                emailVerified,
              },
            });
          } catch (err) {
            done(err);
          }
        }
      )
    );
  }

  if (config.oauth.github.enabled) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: config.oauth.github.clientId,
          clientSecret: config.oauth.github.clientSecret,
          callbackURL: `${callbackURL}/api/auth/github/callback`,
          scope: ['user:email'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            let email = profile.emails?.[0]?.value ?? null;
            let emailVerified = false;
            if (!email || email.trim() === '') {
              try {
                const res = await fetch('https://api.github.com/user/emails', {
                  headers: {
                    Accept: 'application/vnd.github+json',
                    Authorization: `Bearer ${accessToken}`,
                  },
                });
                if (res.ok) {
                  const emails = await res.json();
                  const primaryVerified =
                    Array.isArray(emails) &&
                    emails.find((e) => e.primary === true && e.verified === true);
                  const firstVerified =
                    Array.isArray(emails) && emails.find((e) => e.verified === true);
                  const chosen = primaryVerified || firstVerified;
                  if (chosen) {
                    email = chosen.email ?? null;
                    emailVerified = true;
                  }
                }
              } catch {
                // Leave email null, emailVerified false
              }
            } else {
              emailVerified = true;
            }
            const existingIdentity = await userRepository.findIdentityByProvider(
              'github',
              profile.id
            );
            if (existingIdentity) {
              const user = await userRepository.findById(existingIdentity.user_id);
              done(null, { user, pendingSignup: false });
              return;
            }
            const normalizedEmail = normalizeEmail(email);
            if (normalizedEmail && emailVerified) {
              const byEmail = await userRepository.findIdentitiesByEmail(normalizedEmail);
              if (byEmail.length === 1) {
                const existingUserId = byEmail[0].user_id;
                await userRepository.linkIdentity(existingUserId, {
                  provider: 'github',
                  providerUserId: profile.id,
                  email: normalizedEmail,
                  displayName: profile.displayName || profile.username || null,
                  avatarUrl: profile.photos?.[0]?.value || null,
                });
                const user = await userRepository.findById(existingUserId);
                done(null, { user, pendingSignup: false });
                return;
              }
            }
            done(null, {
              pendingSignup: true,
              profile: {
                provider: 'github',
                providerUserId: profile.id,
                displayName: profile.displayName || profile.username || null,
                avatarUrl: profile.photos?.[0]?.value || null,
                email: normalizedEmail,
                emailVerified,
              },
            });
          } catch (err) {
            done(err);
          }
        }
      )
    );
  }

  return passport;
}

module.exports = { configurePassport };
