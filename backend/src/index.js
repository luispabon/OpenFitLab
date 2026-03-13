const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const db = require('./db');
const config = require('./config');
const { requireAuth } = require('./middleware/require-auth');
const { csrfProtection } = require('./middleware/csrf');
const { apiLimiter, authLimiter, callbackLimiter } = require('./middleware/rate-limit');
const authRouter = require('./routes/auth');
const accountRouter = require('./routes/account');
const eventsRouter = require('./routes/events');
const comparisonsRouter = require('./routes/comparisons');
const foldersRouter = require('./routes/folders');
const metaRouter = require('./routes/meta');

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline for dev if needed
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind needs inline styles
        imgSrc: ["'self'", 'data:', 'https:'], // OAuth avatars
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        frameSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// CORS lockdown - only enable credentials for trusted origins in production
app.use(cors({ origin: config.server.corsAllowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Global rate limit
app.use('/api', apiLimiter);

// Public routes (no session needed)
app.get('/', (req, res) => {
  res.json({ ok: true });
});

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, error: 'Database connection failed' });
  }
});

async function start() {
  const uploadDir = config.server.uploadDir;
  // uploadDir from config (env), not user input
  /* eslint-disable-next-line security/detect-non-literal-fs-filename */
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  await db.runMigrations();

  // Session + Passport (session store: Valkey via connect-redis)
  const { createSessionMiddleware } = require('./middleware/session');
  const { configurePassport } = require('./middleware/passport');
  const sessionMiddleware = await createSessionMiddleware();
  app.use(sessionMiddleware);
  const passport = configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(csrfProtection);

  // Auth routes (public — session middleware is applied above)
  app.use('/api/auth/google', authLimiter);
  app.use('/api/auth/github', authLimiter);
  app.use('/api/auth/google/callback', callbackLimiter);
  app.use('/api/auth/github/callback', callbackLimiter);
  app.use('/api/auth', authRouter);

  // Protected routes (require auth)
  app.use('/api/events', requireAuth, eventsRouter);
  app.use('/api/comparisons', requireAuth, comparisonsRouter);
  app.use('/api/folders', requireAuth, foldersRouter);
  app.use('/api/account', requireAuth, accountRouter);
  app.use('/api', requireAuth, metaRouter);

  // Central error handler for async routes
  const { errorHandler } = require('./middleware/error-handler');
  app.use((err, req, res, next) => {
    console.error(err);
    errorHandler(err, req, res, next);
  });

  app.listen(config.server.port, '0.0.0.0', () => {
    console.log(`API listening on http://0.0.0.0:${config.server.port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  throw err;
});
