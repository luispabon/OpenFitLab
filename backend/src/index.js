const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { requireAuth } = require('./middleware/require-auth');
const authRouter = require('./routes/auth');
const accountRouter = require('./routes/account');
const eventsRouter = require('./routes/events');
const comparisonsRouter = require('./routes/comparisons');
const metaRouter = require('./routes/meta');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));

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

// Central error handler for async routes
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  const message = err && err.message ? err.message : 'Internal server error';
  const statusCode =
    typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;
  res.status(statusCode).json({ error: message });
});

async function start() {
  const uploadDir =
    typeof UPLOAD_DIR === 'string' && UPLOAD_DIR.trim().length > 0
      ? UPLOAD_DIR.trim()
      : path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  await db.initializeSchema();

  // Session + Passport (needs DB pool for session store)
  const { createSessionMiddleware } = require('./middleware/session');
  const { configurePassport } = require('./middleware/passport');
  const pool = await db.getPool();
  app.use(createSessionMiddleware(pool));
  const passport = configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());

  // Auth routes (public — session middleware is applied above)
  app.use('/api/auth', authRouter);

  // Protected routes (require auth)
  app.use('/api/events', requireAuth, eventsRouter);
  app.use('/api/comparisons', requireAuth, comparisonsRouter);
  app.use('/api/account', requireAuth, accountRouter);
  app.use('/api', requireAuth, metaRouter);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  throw err;
});
