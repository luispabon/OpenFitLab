const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const userRepository = require('../repositories/user-repository');

/**
 * Configures Passport with Google and GitHub OAuth strategies.
 * Strategies are only registered when the corresponding env vars are set.
 */
function configurePassport() {
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await userRepository.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  const callbackURL = process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000';

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${callbackURL}/api/auth/google/callback`,
          scope: ['profile', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const result = await userRepository.findOrCreateByIdentity('google', profile.id, {
              displayName: profile.displayName || null,
              avatarUrl: profile.photos?.[0]?.value || null,
              email: profile.emails?.[0]?.value || null,
              emailVerified: profile._json?.email_verified === true,
              profileData: profile._json || null,
            });
            done(null, result.user);
          } catch (err) {
            done(err);
          }
        }
      )
    );
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
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
                // Leave email null, emailVerified false; login still creates/links by provider only
              }
            } else {
              emailVerified = true;
            }
            const result = await userRepository.findOrCreateByIdentity('github', profile.id, {
              displayName: profile.displayName || profile.username || null,
              avatarUrl: profile.photos?.[0]?.value || null,
              email,
              emailVerified,
              profileData: profile._json || null,
            });
            done(null, result.user);
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
