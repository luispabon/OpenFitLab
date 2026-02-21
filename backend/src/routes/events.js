const express = require('express');
const multer = require('multer');
const db = require('../db');
const FileParser = require('../parsers/file-parser');
const {
  parseJSONField,
  aggregateStats,
  mapEventRow,
  mapActivityRow,
  placeholders,
} = require('../utils/transforms');
const { enrichEventsWithStatsAndActivities, getEventById } = require('../services/event-query-service');
const { processUpload } = require('../services/event-upload-service');
const { deleteEventById } = require('../services/event-delete-service');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
});

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const {
  validateGetEventsQuery,
  validateGetActivityRowsQuery,
  validateEventId,
  validateActivityId,
  validateStreamTypes,
} = require('../utils/validation');

// GET /api/events?startDate=&endDate=&limit=&orderBy=
router.get(
  '/',
  validateGetEventsQuery,
  asyncHandler(async (req, res) => {
    let sql =
      'SELECT id, start_date, name, end_date, description, is_merge, src_file_type FROM events WHERE 1=1';
    const params = [];
    if (req.query.startDate != null) {
      sql += ' AND start_date >= ?';
      params.push(Number(req.query.startDate));
    }
    if (req.query.endDate != null) {
      sql += ' AND start_date <= ?';
      params.push(Number(req.query.endDate));
    }
    sql += ' ORDER BY start_date DESC';
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    sql += ' LIMIT ?';
    params.push(limit);
    const rows = await db.query(sql, params);
    if (rows.length === 0) {
      return res.json([]);
    }
    const events = await enrichEventsWithStatsAndActivities(rows);
    res.json(events);
  })
);

// GET /api/events/activity-rows?limit=&offset=&startDate=&endDate=&activityTypes=&devices=&search=
// Returns { rows: Array<{ event, activity }>, total } with pagination and filters applied.
router.get(
  '/activity-rows',
  validateGetActivityRowsQuery,
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 50);
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const startDate = req.query.startDate != null ? Number(req.query.startDate) : null;
    const endDate = req.query.endDate != null ? Number(req.query.endDate) : null;
    const activityTypes = req.query.activityTypes != null
      ? (Array.isArray(req.query.activityTypes) ? req.query.activityTypes : [req.query.activityTypes]).map((t) => String(t).trim()).filter(Boolean)
      : [];
    const devices = req.query.devices != null
      ? (Array.isArray(req.query.devices) ? req.query.devices : [req.query.devices]).map((d) => String(d).trim()).filter(Boolean)
      : [];
    const searchRaw = req.query.search != null ? String(req.query.search).trim() : '';

    // Build base FROM and param list
    let sql = 'FROM events e INNER JOIN activities a ON e.id = a.event_id WHERE 1=1';
    const params = [];

    // Date range on activity start (fallback to event start)
    if (startDate != null) {
      sql += ' AND COALESCE(a.start_date, e.start_date) >= ?';
      params.push(startDate);
    }
    if (endDate != null) {
      sql += ' AND COALESCE(a.start_date, e.start_date) <= ?';
      params.push(endDate);
    }

    // Activity types (OR within filter)
    if (activityTypes.length > 0) {
      sql += ` AND a.type IN (${placeholders(activityTypes.length)})`;
      params.push(...activityTypes);
    }

    // Device filter: by activity device_name column
    if (devices.length > 0) {
      sql += ` AND a.device_name IN (${placeholders(devices.length)})`;
      params.push(...devices);
    }

    // Search: event name, activity name, activity type (LIKE %term%)
    if (searchRaw.length > 0) {
      const escapeLike = (s) => String(s).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
      const searchTerm = `%${escapeLike(searchRaw)}%`;
      sql += ' AND (e.name LIKE ? OR a.name LIKE ? OR a.type LIKE ?)';
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const countParams = [...params];
    const countSql = `SELECT COUNT(*) AS total ${sql}`;
    const countResult = await db.query(countSql, countParams);
    const total = Number(countResult[0]?.total ?? 0);

    if (total === 0) {
      return res.json({ rows: [], total: 0 });
    }

    const orderAndPage = ' ORDER BY COALESCE(a.start_date, e.start_date) DESC LIMIT ? OFFSET ?';
    const mainParams = [...params, limit, offset];
    const mainSql = `SELECT e.id AS event_id, a.id AS activity_id ${sql}${orderAndPage}`;
    const pairRows = await db.query(mainSql, mainParams);

    const eventIds = [...new Set(pairRows.map((r) => r.event_id))];
    const activityIds = pairRows.map((r) => r.activity_id);

    const [eventRows, activityRows, eventStatsRows, activityStatsRows] = await Promise.all([
      db.query(
        `SELECT id, start_date, name, end_date, description, is_merge, src_file_type FROM events WHERE id IN (${placeholders(eventIds.length)})`,
        eventIds
      ),
      db.query(
        `SELECT id, event_id, name, start_date, end_date, type, event_start_date, device_name FROM activities WHERE id IN (${placeholders(activityIds.length)})`,
        activityIds
      ),
      db.query(
        `SELECT event_id, stat_type, value FROM event_stats WHERE event_id IN (${placeholders(eventIds.length)})`,
        eventIds
      ),
      db.query(
        `SELECT activity_id, stat_type, value FROM activity_stats WHERE activity_id IN (${placeholders(activityIds.length)})`,
        activityIds
      ),
    ]);

    const eventsById = Object.fromEntries(eventRows.map((r) => [r.id, r]));
    const activitiesById = Object.fromEntries(activityRows.map((r) => [r.id, r]));
    const statsByEventId = aggregateStats(eventStatsRows, 'event_id');
    const statsByActivityId = aggregateStats(activityStatsRows, 'activity_id');

    const rows = pairRows.map(({ event_id, activity_id }) => {
      const eventRow = eventsById[event_id];
      const activityRow = activitiesById[activity_id];
      if (!eventRow || !activityRow) return null;
      return {
        event: mapEventRow(eventRow, statsByEventId[event_id]),
        activity: mapActivityRow(activityRow, statsByActivityId[activity_id]),
      };
    }).filter(Boolean);

    res.json({ rows, total });
  })
);

// GET /api/events/:id/candidates (must come before /:id route)
router.get(
  '/:id/candidates',
  validateEventId,
  asyncHandler(async (req, res) => {
    const sourceEventId = req.params.id;
    
    // Get source event's time range
    const sourceEvent = await db.queryOne(
      'SELECT start_date, end_date FROM events WHERE id = ?',
      [sourceEventId]
    );
    
    if (!sourceEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const sourceStartDate = Number(sourceEvent.start_date);
    const sourceEndDate = sourceEvent.end_date != null ? Number(sourceEvent.end_date) : sourceStartDate;

    // Find candidate events that actually overlap in time with the source event
    // Overlap: candidate.start <= source.end AND candidate.end >= source.start
    const sql = `
      SELECT id, start_date, name, end_date, description, is_merge, src_file_type
      FROM events
      WHERE id != ?
        AND start_date <= ?
        AND COALESCE(end_date, start_date) >= ?
      ORDER BY start_date DESC
      LIMIT 50
    `;
    const rows = await db.query(sql, [sourceEventId, sourceEndDate, sourceStartDate]);
    
    if (rows.length === 0) {
      return res.json([]);
    }
    const events = await enrichEventsWithStatsAndActivities(rows);
    res.json(events);
  })
);

// GET /api/events/:id
router.get(
  '/:id',
  validateEventId,
  asyncHandler(async (req, res) => {
    const result = await getEventById(req.params.id);
    if (!result) return res.status(404).json({ error: 'Event not found' });
    res.json(result);
  })
);

// File download endpoint removed - files are no longer stored

// POST /api/events (multipart: files only)
router.post(
  '/',
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }
    const primaryFile = req.files[0];
    const extension = FileParser.getExtension(primaryFile.originalname || 'file');
    if (!extension) {
      return res.status(400).json({ error: 'Unable to determine file extension' });
    }
    const { eventId, eventJson, activities } = await processUpload(
      primaryFile.buffer,
      extension,
      primaryFile.originalname || 'file'
    );
    res.status(201).json({ id: eventId, event: eventJson, activities });
  })
);

// GET /api/events/:id/activities/:activityId/streams
router.get(
  '/:id/activities/:activityId/streams',
  validateEventId,
  validateActivityId,
  validateStreamTypes,
  asyncHandler(async (req, res) => {
    const { id: eventId, activityId } = req.params;
    const streamTypes = req.query.types ? (Array.isArray(req.query.types) ? req.query.types : [req.query.types]) : null;
    
    // Get stream metadata
    let sql = 'SELECT id, type FROM streams WHERE activity_id = ? AND event_id = ?';
    const params = [activityId, eventId];
    
    if (streamTypes && streamTypes.length > 0) {
      sql += ` AND type IN (${placeholders(streamTypes.length)})`;
      params.push(...streamTypes);
    }
    
    sql += ' ORDER BY type';
    const streamRows = await db.query(sql, params);

    if (streamRows.length === 0) {
      return res.json([]);
    }

    const streamIds = streamRows.map((r) => r.id);
    const dataPointRows = await db.query(
      `SELECT stream_id, time_ms, value, sequence_index
       FROM stream_data_points
       WHERE stream_id IN (${placeholders(streamIds.length)})
       ORDER BY stream_id, sequence_index ASC, time_ms ASC`,
      streamIds
    );

    const dataByStreamId = {};
    for (const row of dataPointRows) {
      if (!dataByStreamId[row.stream_id]) dataByStreamId[row.stream_id] = [];
      dataByStreamId[row.stream_id].push({
        time: row.time_ms,
        value: parseJSONField(row.value),
      });
    }

    const streams = streamRows.map((streamRow) => ({
      type: streamRow.type,
      data: dataByStreamId[streamRow.id] || [],
    }));
    
    res.json(streams);
  })
);

// PATCH /api/events/:id/activities/:activityId
router.patch(
  '/:id/activities/:activityId',
  validateEventId,
  validateActivityId,
  asyncHandler(async (req, res) => {
    const { id: eventId, activityId } = req.params;
    const { type: typeUpdate, deviceName } = req.body || {};

    if ((typeUpdate === undefined || typeUpdate === null) && (deviceName === undefined || deviceName === null)) {
      return res.status(400).json({ error: 'Provide at least one of type or deviceName' });
    }

    const activity = await db.queryOne(
      'SELECT id, event_id, name, start_date, end_date, type, event_start_date, device_name FROM activities WHERE id = ? AND event_id = ?',
      [activityId, eventId]
    );
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    await db.transaction(async (conn) => {
      if (typeUpdate !== undefined && typeUpdate !== null) {
        const typeValue = String(typeUpdate).trim() || null;
        await conn.execute(
          'UPDATE activities SET type = ? WHERE id = ? AND event_id = ?',
          [typeValue, activityId, eventId]
        );
        const activityRows = await conn.execute(
          'SELECT type FROM activities WHERE event_id = ?',
          [eventId]
        );
        const types = [...new Set((activityRows[0] || []).map((r) => r.type).filter(Boolean))].sort();
        await conn.execute(
          'INSERT INTO event_stats (event_id, stat_type, value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
          [eventId, 'Activity Types', JSON.stringify(types)]
        );
      }

      if (deviceName !== undefined && deviceName !== null) {
        const deviceValue = String(deviceName).trim() || null;
        await conn.execute(
          'UPDATE activities SET device_name = ? WHERE id = ? AND event_id = ?',
          [deviceValue, activityId, eventId]
        );
      }
    });

    const [updatedRow] = await db.query(
      'SELECT id, event_id, name, start_date, end_date, type, event_start_date, device_name FROM activities WHERE id = ? AND event_id = ?',
      [activityId, eventId]
    );
    const statsRows = await db.query(
      'SELECT stat_type, value FROM activity_stats WHERE activity_id = ?',
      [activityId]
    );
    const activityStats = aggregateStats(statsRows);
    res.json(mapActivityRow(updatedRow, activityStats));
  })
);

// DELETE /api/events/:id
router.delete(
  '/:id',
  validateEventId,
  asyncHandler(async (req, res) => {
    const deleted = await deleteEventById(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Event not found' });
    res.status(204).send();
  })
);

module.exports = router;
