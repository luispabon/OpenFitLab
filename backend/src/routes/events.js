const express = require('express');
const multer = require('multer');
const { randomUUID } = require('crypto');
const db = require('../db');
const FileParser = require('../parsers/file-parser');
const { extractStreamDataPointsFromJSON } = require('../utils/stream-extractor');
const {
  parseJSONField,
  toTimestamp,
  aggregateStats,
  mapEventRow,
  mapActivityRow,
  placeholders,
} = require('../utils/transforms');

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
    const eventIds = rows.map((r) => r.id);
    const [statsRows, activityRows] = await Promise.all([
      db.query(
        `SELECT event_id, stat_type, value FROM event_stats WHERE event_id IN (${placeholders(eventIds.length)})`,
        eventIds
      ),
      db.query(
        `SELECT id, event_id, name, start_date, end_date, type, event_start_date, device_name FROM activities WHERE event_id IN (${placeholders(eventIds.length)})`,
        eventIds
      ),
    ]);
    const statsByEventId = aggregateStats(statsRows, 'event_id');
    const events = rows.map((r) => mapEventRow(r, statsByEventId[r.id]));

    if (activityRows.length > 0) {
      const activityIds = activityRows.map((a) => a.id);
      const activityStatsRows = await db.query(
        `SELECT activity_id, stat_type, value FROM activity_stats WHERE activity_id IN (${placeholders(activityIds.length)})`,
        activityIds
      );
      const statsByActivityId = aggregateStats(activityStatsRows, 'activity_id');
      const activitiesByEventId = {};
      for (const a of activityRows) {
        if (!activitiesByEventId[a.event_id]) activitiesByEventId[a.event_id] = [];
        activitiesByEventId[a.event_id].push(mapActivityRow(a, statsByActivityId[a.id]));
      }
      for (const ev of events) {
        ev.activities = activitiesByEventId[ev.id] || [];
      }
    } else {
      for (const ev of events) {
        ev.activities = [];
      }
    }

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
    
    // Fetch stats and activities (same pattern as GET /)
    const eventIds = rows.map((r) => r.id);
    const [statsRows, activityRows] = await Promise.all([
      db.query(
        `SELECT event_id, stat_type, value FROM event_stats WHERE event_id IN (${placeholders(eventIds.length)})`,
        eventIds
      ),
      db.query(
        `SELECT id, event_id, name, start_date, end_date, type, event_start_date, device_name FROM activities WHERE event_id IN (${placeholders(eventIds.length)})`,
        eventIds
      ),
    ]);
    
    const statsByEventId = aggregateStats(statsRows, 'event_id');
    const events = rows.map((r) => mapEventRow(r, statsByEventId[r.id]));
    
    if (activityRows.length > 0) {
      const activityIds = activityRows.map((a) => a.id);
      const activityStatsRows = await db.query(
        `SELECT activity_id, stat_type, value FROM activity_stats WHERE activity_id IN (${placeholders(activityIds.length)})`,
        activityIds
      );
      const statsByActivityId = aggregateStats(activityStatsRows, 'activity_id');
      const activitiesByEventId = {};
      for (const a of activityRows) {
        if (!activitiesByEventId[a.event_id]) activitiesByEventId[a.event_id] = [];
        activitiesByEventId[a.event_id].push(mapActivityRow(a, statsByActivityId[a.id]));
      }
      for (const ev of events) {
        ev.activities = activitiesByEventId[ev.id] || [];
      }
    } else {
      for (const ev of events) {
        ev.activities = [];
      }
    }
    
    res.json(events);
  })
);

// GET /api/events/:id
router.get(
  '/:id',
  validateEventId,
  asyncHandler(async (req, res) => {
    const event = await db.queryOne(
      'SELECT id, start_date, name, end_date, description, is_merge, src_file_type FROM events WHERE id = ?',
      [req.params.id]
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const activities = await db.query(
      'SELECT id, event_id, name, start_date, end_date, type, event_start_date, device_name FROM activities WHERE event_id = ?',
      [req.params.id]
    );
    const [eventStatsRows, activityStatsRows] = await Promise.all([
      db.query('SELECT stat_type, value FROM event_stats WHERE event_id = ?', [req.params.id]),
      activities.length > 0
        ? db.query(
            `SELECT activity_id, stat_type, value FROM activity_stats WHERE activity_id IN (${placeholders(
              activities.length
            )})`,
            activities.map((a) => a.id)
          )
        : [],
    ]);
    const eventStats = aggregateStats(eventStatsRows);
    const activityStatsById = aggregateStats(activityStatsRows, 'activity_id');
    const eventJson = mapEventRow(event, eventStats);
    const activitiesJson = activities.map((a) => mapActivityRow(a, activityStatsById[a.id]));
    res.json({ event: eventJson, activities: activitiesJson });
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

    // Parse the first file (we'll use it as the primary event)
    // In the future, we could support multiple files for multi-activity events
    const primaryFile = req.files[0];
    const extension = FileParser.getExtension(primaryFile.originalname || 'file');
    
    if (!extension) {
      return res.status(400).json({ error: 'Unable to determine file extension' });
    }

    // Parse the file
    const event = await FileParser.parseFile(
      primaryFile.buffer,
      extension,
      primaryFile.originalname || 'file'
    );

    // Generate new UUID for event - each upload is a new event
    const eventId = randomUUID();
    const startDate = toTimestamp(event.startDate, Date.now());
    // Always use filename as event name (remove extension and trim)
    const name = (primaryFile.originalname && primaryFile.originalname.trim())
      ? primaryFile.originalname.replace(/\.[^/.]+$/, '').trim()
      : (event.name && event.name.trim() ? event.name.trim() : 'Untitled Event');

    // Extract event JSON and split into columns and stats
    const eventJson = event.toJSON();
    const eventStats = eventJson.stats && typeof eventJson.stats === 'object' ? eventJson.stats : {};
    const eventEndDate = toTimestamp(eventJson.endDate, null);
    const eventDescription = eventJson.description != null ? String(eventJson.description) : null;
    const eventIsMerge = eventJson.isMerge === true || eventJson.isMerge === 1 ? 1 : 0;
    const srcFileType = extension || null;

    // Store everything in a single transaction
    await db.transaction(async (conn) => {
      // Store event
      await conn.execute(
        `INSERT INTO events (id, start_date, name, end_date, description, is_merge, src_file_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [eventId, startDate, name, eventEndDate, eventDescription, eventIsMerge, srcFileType]
      );

      // Store event stats
      for (const [statType, value] of Object.entries(eventStats)) {
        if (value === undefined || value === null) continue;
        await conn.execute(
          'INSERT INTO event_stats (event_id, stat_type, value) VALUES (?, ?, ?)',
          [eventId, statType, JSON.stringify(value)]
        );
      }

      // Process activities
      const activities = event.getActivities();
      const generatedActivityIds = [];

      for (const activity of activities) {
        const aid = randomUUID();
        generatedActivityIds.push(aid);

        const activityJson = activity.toJSON();
        const streams = activityJson.streams;
        const aStats = activityJson.stats && typeof activityJson.stats === 'object' ? activityJson.stats : {};
        const aName = activityJson.name != null ? String(activityJson.name) : null;
        const aStartDate = toTimestamp(activityJson.startDate, null);
        const aEndDate = toTimestamp(activityJson.endDate, null);
        const aType = activityJson.type != null ? String(activityJson.type) : null;

        const deviceName = (activityJson.creator && typeof activityJson.creator === 'object' && activityJson.creator.name != null)
          ? String(activityJson.creator.name).trim()
          : null;

        await conn.execute(
          'INSERT INTO activities (id, event_id, name, start_date, end_date, type, event_start_date, device_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [aid, eventId, aName, aStartDate, aEndDate, aType, startDate, deviceName || null]
        );

        for (const [statType, value] of Object.entries(aStats)) {
          if (value === undefined || value === null) continue;
          if (statType === 'Device Names') continue;
          await conn.execute(
            'INSERT INTO activity_stats (activity_id, stat_type, value) VALUES (?, ?, ?)',
            [aid, statType, JSON.stringify(value)]
          );
        }
        
        // Store streams with timestamped data points
        if (streams) {
          // Get activity start date (use activity's own start date if available, otherwise use event start date)
          const activityStartDate = toTimestamp(activity.startDate, startDate);
          
          // Extract stream data points with timestamps
          // Note: extractStreamDataPointsFromJSON filters out null/undefined/NaN values
          // and excludes streams with no valid data points
          const streamDataPoints = extractStreamDataPointsFromJSON(
            { ...activityJson, streams },
            activityStartDate
          );
          
          for (const streamInfo of streamDataPoints) {
            // Skip streams with no valid data points (already filtered by extractStreamDataPointsFromJSON)
            if (!streamInfo || !streamInfo.type || !streamInfo.dataPoints || streamInfo.dataPoints.length === 0) {
              continue;
            }
            
            const streamId = `${aid}_${streamInfo.type}`;
            
            // Insert stream metadata
            await conn.execute(
              'INSERT INTO streams (id, activity_id, event_id, type) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
              [streamId, aid, eventId, streamInfo.type]
            );
            
            // Insert data points in batches (MySQL has a limit on placeholders, typically 65535)
            // Process in chunks of 1000 to be safe
            const batchSize = 1000;
            const dataPointValues = streamInfo.dataPoints.map((dp, index) => [
              streamId,
              dp.time,
              JSON.stringify(dp.value),
              index
            ]);
            
            for (let i = 0; i < dataPointValues.length; i += batchSize) {
              const batch = dataPointValues.slice(i, i + batchSize);
              const batchPlaceholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
              const flatValues = batch.flat();
              await conn.execute(
                `INSERT IGNORE INTO stream_data_points (stream_id, time_ms, value, sequence_index) VALUES ${batchPlaceholders}`,
                flatValues
              );
            }
          }
        }
      }
    });

    // Build response (non-DB work can happen after transaction)
    const activities = event.getActivities();
    const generatedActivityIds = activities.map(() => null);

    const responseActivities = activities.map((activity, idx) => {
      const activityJson = activity.toJSON();
      return {
        ...activityJson,
        id: generatedActivityIds[idx] || null,
      };
    });

    res.status(201).json({
      id: eventId,
      event: {
        ...eventJson,
        id: eventId,
        startDate,
        name,
      },
      activities: responseActivities,
    });
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
    const eventId = req.params.id;

    // Ensure event exists before attempting delete
    const existing = await db.queryOne('SELECT id FROM events WHERE id = ?', [eventId]);
    if (!existing) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await db.transaction(async (conn) => {
      const [activityRows] = await conn.execute('SELECT id FROM activities WHERE event_id = ?', [eventId]);
      const activityIds = activityRows.map((r) => r.id);

      if (activityIds.length > 0) {
        await conn.execute(
          `DELETE FROM activity_stats WHERE activity_id IN (${placeholders(activityIds.length)})`,
          activityIds
        );
      }
      await conn.execute('DELETE FROM event_stats WHERE event_id = ?', [eventId]);

      const [streamRows] = await conn.execute('SELECT id FROM streams WHERE event_id = ?', [eventId]);
      const streamIds = streamRows.map((r) => r.id);
      if (streamIds.length > 0) {
        await conn.execute(
          `DELETE FROM stream_data_points WHERE stream_id IN (${placeholders(streamIds.length)})`,
          streamIds
        );
      }

      await conn.execute('DELETE FROM streams WHERE event_id = ?', [eventId]);
      await conn.execute('DELETE FROM activities WHERE event_id = ?', [eventId]);
      await conn.execute('DELETE FROM original_files WHERE event_id = ?', [eventId]);
      await conn.execute('DELETE FROM events WHERE id = ?', [eventId]);
    });

    res.status(204).send();
  })
);

module.exports = router;
