const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const eventsRouter = require('./routes/events');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.json({ ok: true });
});

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ ok: false, error: 'Database connection failed' });
  }
});

app.use('/api/events', eventsRouter);

// Central error handler for async routes
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }
  const message = err && err.message ? err.message : 'Internal server error';
  const statusCode = message && message.includes('Failed to parse') ? 400 : 500;
  res.status(statusCode).json({ error: message });
});

async function start() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  await db.initializeSchema();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
