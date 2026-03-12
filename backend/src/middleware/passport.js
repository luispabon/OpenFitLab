const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const AppleStrategy = require('passport-apple');
const FacebookStrategy = require('passport-facebook').Strategy;
const userRepository = require('../repositories/user-repository');
const { normalizeEmail } = require('../utils/email');
const config = require('../config');

/**
 * Configures Passport with Google, GitHub, Apple, and Facebook OAuth strategies.
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

  if (config.oauth.apple.enabled) {
    passport.use(
      new AppleStrategy(
        {
          clientID: config.oauth.apple.clientId,
          teamID: config.oauth.apple.teamId,
          keyID: config.oauth.apple.keyId,
          privateKeyString: config.oauth.apple.privateKey,
          callbackURL: `${callbackURL}/api/auth/apple/callback`,
        },
        async (accessToken, refreshToken, idToken, profile, done) => {
          try {
            const providerId = idToken?.sub ?? profile?.id;
            if (!providerId) {
              return done(new Error('Apple did not return a user identifier'));
            }
            const existingIdentity = await userRepository.findIdentityByProvider(
              'apple',
              providerId
            );
            if (existingIdentity) {
              const user = await userRepository.findById(existingIdentity.user_id);
              done(null, { user, pendingSignup: false });
              return;
            }
            // Email is only present on the first login
            const rawEmail = idToken?.email ?? profile?.email ?? null;
            const normalizedEmail = normalizeEmail(rawEmail);
            const emailVerified = idToken?.email_verified === true;
            if (normalizedEmail && emailVerified) {
              const byEmail = await userRepository.findIdentitiesByEmail(normalizedEmail);
              if (byEmail.length === 1) {
                const existingUserId = byEmail[0].user_id;
                await userRepository.linkIdentity(existingUserId, {
                  provider: 'apple',
                  providerUserId: providerId,
                  email: normalizedEmail,
                  displayName: profile?.displayName || null,
                  avatarUrl: null,
                });
                const user = await userRepository.findById(existingUserId);
                done(null, { user, pendingSignup: false });
                return;
              }
            }
            done(null, {
              pendingSignup: true,
              profile: {
                provider: 'apple',
                providerUserId: providerId,
                displayName: profile?.displayName || null,
                avatarUrl: null,
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

  if (config.oauth.facebook.enabled) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: config.oauth.facebook.clientId,
          clientSecret: config.oauth.facebook.clientSecret,
          callbackURL: `${callbackURL}/api/auth/facebook/callback`,
          profileFields: ['id', 'displayName', 'photos', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const existingIdentity = await userRepository.findIdentityByProvider(
              'facebook',
              profile.id
            );
            if (existingIdentity) {
              const user = await userRepository.findById(existingIdentity.user_id);
              done(null, { user, pendingSignup: false });
              return;
            }
            const normalizedEmail = normalizeEmail(profile.emails?.[0]?.value);
            // Facebook emails from the API are considered verified
            const emailVerified = !!normalizedEmail;
            if (normalizedEmail && emailVerified) {
              const byEmail = await userRepository.findIdentitiesByEmail(normalizedEmail);
              if (byEmail.length === 1) {
                const existingUserId = byEmail[0].user_id;
                await userRepository.linkIdentity(existingUserId, {
                  provider: 'facebook',
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
                provider: 'facebook',
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

  return passport;
}

module.exports = { configurePassport };
