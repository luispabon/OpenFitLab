const express = require('express');
const multer = require('multer');
const { randomUUID } = require('crypto');
const db = require('../db');
const FileParser = require('../parsers/file-parser');
const { extractStreamDataPointsFromJSON } = require('../utils/stream-extractor');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/events?startDate=&endDate=&limit=&orderBy=
router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT id, start_date, name, privacy, end_date, description, is_merge, payload_rest FROM events WHERE 1=1';
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
    const placeholders = eventIds.map(() => '?').join(',');
    const statsRows = await db.query(
      `SELECT event_id, stat_type, value FROM event_stats WHERE event_id IN (${placeholders})`,
      eventIds
    );
    const statsByEventId = {};
    for (const s of statsRows) {
      if (!statsByEventId[s.event_id]) statsByEventId[s.event_id] = {};
      statsByEventId[s.event_id][s.stat_type] = typeof s.value === 'object' ? s.value : JSON.parse(s.value);
    }
    const events = rows.map((r) => {
      const payloadRest = typeof r.payload_rest === 'object' ? r.payload_rest : r.payload_rest ? JSON.parse(r.payload_rest) : {};
      return {
        id: r.id,
        startDate: Number(r.start_date),
        name: r.name,
        privacy: r.privacy,
        ...(r.end_date != null ? { endDate: Number(r.end_date) } : {}),
        ...(r.description != null ? { description: r.description } : {}),
        ...(r.is_merge === 1 ? { isMerge: true } : {}),
        stats: statsByEventId[r.id] || {},
        ...payloadRest,
      };
    });
    res.json(events);
  } catch (e) {
    console.error('GET /api/events', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/events/:id
router.get('/:id', async (req, res) => {
  try {
    const event = await db.queryOne(
      'SELECT id, start_date, name, privacy, end_date, description, is_merge, payload_rest FROM events WHERE id = ?',
      [req.params.id]
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const activities = await db.query(
      'SELECT id, event_id, name, start_date, end_date, type, event_start_date, payload_rest FROM activities WHERE event_id = ?',
      [req.params.id]
    );
    const [eventStatsRows, activityStatsRows] = await Promise.all([
      db.query('SELECT stat_type, value FROM event_stats WHERE event_id = ?', [req.params.id]),
      activities.length > 0
        ? db.query(
            `SELECT activity_id, stat_type, value FROM activity_stats WHERE activity_id IN (${activities.map(() => '?').join(',')})`,
            activities.map((a) => a.id)
          )
        : [],
    ]);
    const eventStats = {};
    for (const s of eventStatsRows) {
      eventStats[s.stat_type] = typeof s.value === 'object' ? s.value : JSON.parse(s.value);
    }
    const activityStatsById = {};
    for (const s of activityStatsRows) {
      if (!activityStatsById[s.activity_id]) activityStatsById[s.activity_id] = {};
      activityStatsById[s.activity_id][s.stat_type] = typeof s.value === 'object' ? s.value : JSON.parse(s.value);
    }
    const eventPayloadRest = typeof event.payload_rest === 'object' ? event.payload_rest : event.payload_rest ? JSON.parse(event.payload_rest) : {};
    const eventJson = {
      id: event.id,
      startDate: Number(event.start_date),
      name: event.name,
      privacy: event.privacy,
      ...(event.end_date != null ? { endDate: Number(event.end_date) } : {}),
      ...(event.description != null ? { description: event.description } : {}),
      ...(event.is_merge === 1 ? { isMerge: true } : {}),
      stats: eventStats,
      ...eventPayloadRest,
    };
    const activitiesJson = activities.map((a) => {
      const aPayloadRest = typeof a.payload_rest === 'object' ? a.payload_rest : a.payload_rest ? JSON.parse(a.payload_rest) : {};
      return {
        id: a.id,
        eventID: a.event_id,
        eventStartDate: a.event_start_date != null ? Number(a.event_start_date) : undefined,
        ...(a.name != null ? { name: a.name } : {}),
        ...(a.start_date != null ? { startDate: Number(a.start_date) } : {}),
        ...(a.end_date != null ? { endDate: Number(a.end_date) } : {}),
        ...(a.type != null ? { type: a.type } : {}),
        stats: activityStatsById[a.id] || {},
        ...aPayloadRest,
      };
    });
    res.json({ event: eventJson, activities: activitiesJson });
  } catch (e) {
    console.error('GET /api/events/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// File download endpoint removed - files are no longer stored

// POST /api/events (multipart: files only)
router.post('/', upload.array('files', 10), async (req, res) => {
  try {
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
    const startDate = event.startDate instanceof Date 
      ? event.startDate.getTime() 
      : (typeof event.startDate === 'number' ? event.startDate : Date.now());
    // Always use filename as event name (remove extension and trim)
    const name = (primaryFile.originalname && primaryFile.originalname.trim())
      ? primaryFile.originalname.replace(/\.[^/.]+$/, '').trim()
      : (event.name && event.name.trim() ? event.name.trim() : 'Untitled Event');
    const privacy = (event.privacy && typeof event.privacy === 'string') ? event.privacy : 'private';

    // Extract event JSON and split into columns, stats, and payload_rest
    const eventJson = event.toJSON();
    const eventStats = eventJson.stats && typeof eventJson.stats === 'object' ? eventJson.stats : {};
    const eventEndDate = eventJson.endDate != null ? (eventJson.endDate instanceof Date ? eventJson.endDate.getTime() : Number(eventJson.endDate)) : null;
    const eventDescription = eventJson.description != null ? String(eventJson.description) : null;
    const eventIsMerge = eventJson.isMerge === true || eventJson.isMerge === 1 ? 1 : 0;
    const eventPayloadRest = { ...eventJson };
    delete eventPayloadRest.id;
    delete eventPayloadRest.startDate;
    delete eventPayloadRest.name;
    delete eventPayloadRest.privacy;
    delete eventPayloadRest.activities;
    delete eventPayloadRest.stats;
    delete eventPayloadRest.endDate;
    delete eventPayloadRest.description;
    delete eventPayloadRest.isMerge;

    // Store event
    await db.query(
      `INSERT INTO events (id, start_date, name, privacy, end_date, description, is_merge, payload_rest) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventId, startDate, name, privacy, eventEndDate, eventDescription, eventIsMerge, JSON.stringify(eventPayloadRest)]
    );

    // Store event stats
    for (const [statType, value] of Object.entries(eventStats)) {
      if (value === undefined || value === null) continue;
      await db.query(
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
      const aStartDate = activityJson.startDate != null ? (activityJson.startDate instanceof Date ? activityJson.startDate.getTime() : Number(activityJson.startDate)) : null;
      const aEndDate = activityJson.endDate != null ? (activityJson.endDate instanceof Date ? activityJson.endDate.getTime() : Number(activityJson.endDate)) : null;
      const aType = activityJson.type != null ? String(activityJson.type) : null;

      const aPayloadRest = { ...activityJson };
      aPayloadRest.eventID = eventId;
      aPayloadRest.eventStartDate = startDate;
      delete aPayloadRest.id;
      delete aPayloadRest.streams;
      delete aPayloadRest.stats;
      delete aPayloadRest.name;
      delete aPayloadRest.startDate;
      delete aPayloadRest.endDate;
      delete aPayloadRest.type;
      delete aPayloadRest.eventID;
      delete aPayloadRest.eventStartDate;

      await db.query(
        'INSERT INTO activities (id, event_id, name, start_date, end_date, type, event_start_date, payload_rest) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [aid, eventId, aName, aStartDate, aEndDate, aType, startDate, JSON.stringify(aPayloadRest)]
      );

      for (const [statType, value] of Object.entries(aStats)) {
        if (value === undefined || value === null) continue;
        await db.query(
          'INSERT INTO activity_stats (activity_id, stat_type, value) VALUES (?, ?, ?)',
          [aid, statType, JSON.stringify(value)]
        );
      }
      
      // Store streams with timestamped data points
      if (streams) {
        // Get activity start date (use activity's own start date if available, otherwise use event start date)
        const activityStartDate = activity.startDate instanceof Date
          ? activity.startDate.getTime()
          : (typeof activity.startDate === 'number' ? activity.startDate : startDate);
        
        // Extract stream data points with timestamps
        const streamDataPoints = extractStreamDataPointsFromJSON(
          { ...activityJson, streams },
          activityStartDate
        );
        
        for (const streamInfo of streamDataPoints) {
          if (!streamInfo || !streamInfo.type || !streamInfo.dataPoints || streamInfo.dataPoints.length === 0) {
            continue;
          }
          
          const streamId = `${aid}_${streamInfo.type}`;
          
          // Insert stream metadata
          await db.query(
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
            const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
            const flatValues = batch.flat();
            await db.query(
              `INSERT IGNORE INTO stream_data_points (stream_id, time_ms, value, sequence_index) VALUES ${placeholders}`,
              flatValues
            );
          }
        }
      }
    }

    // Build response
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
        privacy,
      },
      activities: responseActivities,
    });
  } catch (e) {
    console.error('POST /api/events', e);
    const statusCode = e.message && e.message.includes('Failed to parse') ? 400 : 500;
    res.status(statusCode).json({ error: e.message || 'Internal server error' });
  }
});

// GET /api/events/:id/activities/:activityId/streams
router.get('/:id/activities/:activityId/streams', async (req, res) => {
  try {
    const { id: eventId, activityId } = req.params;
    const streamTypes = req.query.types ? (Array.isArray(req.query.types) ? req.query.types : [req.query.types]) : null;
    
    // Get stream metadata
    let sql = 'SELECT id, type FROM streams WHERE activity_id = ? AND event_id = ?';
    const params = [activityId, eventId];
    
    if (streamTypes && streamTypes.length > 0) {
      const placeholders = streamTypes.map(() => '?').join(',');
      sql += ` AND type IN (${placeholders})`;
      params.push(...streamTypes);
    }
    
    sql += ' ORDER BY type';
    const streamRows = await db.query(sql, params);
    
    // Fetch data points for each stream
    const streams = await Promise.all(streamRows.map(async (streamRow) => {
      const dataPoints = await db.query(
        'SELECT time_ms, value, sequence_index FROM stream_data_points WHERE stream_id = ? ORDER BY sequence_index ASC, time_ms ASC',
        [streamRow.id]
      );
      
      const data = dataPoints.map((dp) => {
        const value = typeof dp.value === 'object' ? dp.value : JSON.parse(dp.value);
        return {
          time: dp.time_ms,
          value: value
        };
      });
      
      return {
        type: streamRow.type,
        data: data
      };
    }));
    
    res.json(streams);
  } catch (e) {
    console.error('GET /api/events/:id/activities/:activityId/streams', e);
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/events/:id
router.delete('/:id', async (req, res) => {
  try {
    const eventId = req.params.id;
    const activityRows = await db.query('SELECT id FROM activities WHERE event_id = ?', [eventId]);
    const activityIds = activityRows.map((r) => r.id);

    if (activityIds.length > 0) {
      const placeholders = activityIds.map(() => '?').join(',');
      await db.query(`DELETE FROM activity_stats WHERE activity_id IN (${placeholders})`, activityIds);
    }
    await db.query('DELETE FROM event_stats WHERE event_id = ?', [eventId]);

    const streamRows = await db.query('SELECT id FROM streams WHERE event_id = ?', [eventId]);
    const streamIds = streamRows.map((r) => r.id);
    if (streamIds.length > 0) {
      const streamPlaceholders = streamIds.map(() => '?').join(',');
      await db.query(`DELETE FROM stream_data_points WHERE stream_id IN (${streamPlaceholders})`, streamIds);
    }

    await db.query('DELETE FROM streams WHERE event_id = ?', [eventId]);
    await db.query('DELETE FROM activities WHERE event_id = ?', [eventId]);
    await db.query('DELETE FROM original_files WHERE event_id = ?', [eventId]);
    const r = await db.query('DELETE FROM events WHERE id = ?', [eventId]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Event not found' });
    res.status(204).send();
  } catch (e) {
    console.error('DELETE /api/events/:id', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
