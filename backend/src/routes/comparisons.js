const express = require('express');
const { randomUUID } = require('crypto');
const db = require('../db');
const { parseJSONField } = require('../utils/transforms');
const {
  validateComparisonId,
  validateComparisonBody,
} = require('../utils/validation');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// POST /api/comparisons
router.post(
  '/',
  validateComparisonBody,
  asyncHandler(async (req, res) => {
    const { name, eventIds, settings } = req.body;
    const id = randomUUID();
    
    await db.query(
      'INSERT INTO comparisons (id, name, event_ids, settings) VALUES (?, ?, ?, ?)',
      [id, name.trim(), JSON.stringify(eventIds), settings ? JSON.stringify(settings) : null]
    );
    
    res.status(201).json({
      id,
      name: name.trim(),
      eventIds,
      settings: settings || null,
      createdAt: Date.now(),
    });
  })
);

// GET /api/comparisons
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await db.query(
      'SELECT id, name, event_ids, settings, created_at FROM comparisons ORDER BY created_at DESC LIMIT 100'
    );
    
    const comparisons = rows.map((row) => ({
      id: row.id,
      name: row.name,
      eventIds: parseJSONField(row.event_ids, []),
      settings: parseJSONField(row.settings, null),
      createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
    }));
    
    res.json(comparisons);
  })
);

// GET /api/comparisons/:id
router.get(
  '/:id',
  validateComparisonId,
  asyncHandler(async (req, res) => {
    const row = await db.queryOne(
      'SELECT id, name, event_ids, settings, created_at FROM comparisons WHERE id = ?',
      [req.params.id]
    );
    
    if (!row) {
      return res.status(404).json({ error: 'Comparison not found' });
    }
    
    res.json({
      id: row.id,
      name: row.name,
      eventIds: parseJSONField(row.event_ids, []),
      settings: parseJSONField(row.settings, null),
      createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
    });
  })
);

// DELETE /api/comparisons/:id
router.delete(
  '/:id',
  validateComparisonId,
  asyncHandler(async (req, res) => {
    const existing = await db.queryOne('SELECT id FROM comparisons WHERE id = ?', [req.params.id]);
    
    if (!existing) {
      return res.status(404).json({ error: 'Comparison not found' });
    }
    
    await db.query('DELETE FROM comparisons WHERE id = ?', [req.params.id]);
    
    res.status(204).send();
  })
);

module.exports = router;
