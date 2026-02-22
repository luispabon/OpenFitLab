const { randomUUID } = require('crypto');
const defaultDb = require('../db');
const FileParser = require('../parsers/file-parser');
const { extractStreamDataPointsFromJSON } = require('../utils/stream-extractor');
const { toTimestamp } = require('../utils/transforms');

/**
 * Parses an uploaded file and persists event, activities, stats, and streams to the DB.
 * @param {Buffer} fileBuffer - Raw file content
 * @param {string} extension - File extension (e.g. 'fit', 'tcx')
 * @param {string} originalFilename - Original filename (used for event name)
 * @param {{ db?: object }} [opts] - Optional; opts.db for test injection
 * @returns {Promise<{ eventId: string, eventJson: object, activities: Array<object> }>}
 */
async function processUpload(fileBuffer, extension, originalFilename, opts = {}) {
  const db = opts.db ?? defaultDb;
  const event = await FileParser.parseFile(fileBuffer, extension, originalFilename);

  const eventId = randomUUID();
  const startDate = toTimestamp(event.startDate, Date.now());
  const name =
    originalFilename && originalFilename.trim()
      ? originalFilename.replace(/\.[^/.]+$/, '').trim()
      : event.name && event.name.trim()
        ? event.name.trim()
        : 'Untitled Event';

  const eventJson = event.toJSON();
  const eventStats = eventJson.stats && typeof eventJson.stats === 'object' ? eventJson.stats : {};
  const eventEndDate = toTimestamp(eventJson.endDate, null);
  const eventDescription = eventJson.description != null ? String(eventJson.description) : null;
  const eventIsMerge = eventJson.isMerge === true || eventJson.isMerge === 1 ? 1 : 0;
  const srcFileType = extension || null;

  await db.transaction(async (conn) => {
    await conn.execute(
      `INSERT INTO events (id, start_date, name, end_date, description, is_merge, src_file_type) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [eventId, startDate, name, eventEndDate, eventDescription, eventIsMerge, srcFileType]
    );

    for (const [statType, value] of Object.entries(eventStats)) {
      if (value === undefined || value === null) continue;
      await conn.execute('INSERT INTO event_stats (event_id, stat_type, value) VALUES (?, ?, ?)', [
        eventId,
        statType,
        JSON.stringify(value),
      ]);
    }

    const activities = event.getActivities();
    for (const activity of activities) {
      const aid = randomUUID();
      const activityJson = activity.toJSON();
      const streams = activityJson.streams;
      const aStats =
        activityJson.stats && typeof activityJson.stats === 'object' ? activityJson.stats : {};
      const aName = activityJson.name != null ? String(activityJson.name) : null;
      const aStartDate = toTimestamp(activityJson.startDate, null);
      const aEndDate = toTimestamp(activityJson.endDate, null);
      const aType = activityJson.type != null ? String(activityJson.type) : null;
      const deviceName =
        activityJson.creator &&
        typeof activityJson.creator === 'object' &&
        activityJson.creator.name != null
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

      if (streams) {
        const activityStartDate = toTimestamp(activity.startDate, startDate);
        const streamDataPoints = extractStreamDataPointsFromJSON(
          { ...activityJson, streams },
          activityStartDate
        );

        for (const streamInfo of streamDataPoints) {
          if (
            !streamInfo ||
            !streamInfo.type ||
            !streamInfo.dataPoints ||
            streamInfo.dataPoints.length === 0
          ) {
            continue;
          }
          const streamId = `${aid}_${streamInfo.type}`;
          await conn.execute(
            'INSERT INTO streams (id, activity_id, event_id, type) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id',
            [streamId, aid, eventId, streamInfo.type]
          );

          const batchSize = 1000;
          const dataPointValues = streamInfo.dataPoints.map((dp, index) => [
            streamId,
            dp.time,
            JSON.stringify(dp.value),
            index,
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

  const activities = event.getActivities();
  const responseActivities = activities.map((activity) => {
    const activityJson = activity.toJSON();
    return { ...activityJson, id: null };
  });

  return {
    eventId,
    eventJson: { ...eventJson, id: eventId, startDate, name },
    activities: responseActivities,
  };
}

module.exports = { processUpload };
