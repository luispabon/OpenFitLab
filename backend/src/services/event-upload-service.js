const FileParser = require('../parsers/file-parser');
const {
  persistParsedEvent,
  buildEventRecord,
  buildActivityRecord,
} = require('./event-persistence');

/**
 * Parses an uploaded file and persists event, activities, stats, and streams to the DB.
 */
async function processUpload(fileBuffer, extension, originalFilename, opts = {}) {
  if (!opts.userId) throw new Error('processUpload requires opts.userId');
  const event = await FileParser.parseFile(fileBuffer, extension, originalFilename);

  const eventName =
    originalFilename && originalFilename.trim()
      ? originalFilename.replace(/\.[^/.]+$/, '').trim()
      : event.name && event.name.trim()
        ? event.name.trim()
        : 'Untitled Event';

  const eventJson = event.toJSON();
  const activities = event.getActivities();
  const activitiesData = activities.map((activity) => ({ activityJson: activity.toJSON() }));

  return persistParsedEvent(
    {
      userId: opts.userId,
      folderId: opts.folderId,
      eventJson,
      activitiesData,
      srcFileType: extension || null,
      importProvider: null,
      importExternalId: null,
      eventName,
      eventTimezone: FileParser.extractEventTimezone(event),
    },
    opts
  );
}

/**
 * Processes a batch of uploaded files and returns per-file results.
 * @param {Array<{ buffer: Buffer, originalname?: string }>} files
 * @param {string} userId
 * @param {Function} processUploadFn - (buffer, extension, filename, opts) => Promise
 * @param {{ folderId?: string | null }} [options]
 * @returns {Promise<Array<{ success: boolean, filename: string, id?: string, event?: object, activities?: array, error?: string }>>}
 */
async function buildUploadResults(files, userId, processUploadFn, options = {}) {
  const results = [];
  const folderId = options.folderId != null && options.folderId !== '' ? options.folderId : null;
  for (const file of files) {
    const filename = file.originalname || 'file';
    const extension = FileParser.getExtension(filename);
    if (!extension) {
      results.push({ success: false, filename, error: 'Unsupported file type' });
      continue;
    }
    try {
      const { eventId, eventJson, activities } = await processUploadFn(
        file.buffer,
        extension,
        filename,
        { userId, folderId: folderId || undefined }
      );
      results.push({
        success: true,
        filename,
        id: eventId,
        event: eventJson,
        activities,
      });
    } catch (err) {
      results.push({
        success: false,
        filename,
        error: err.message || 'Failed to parse file',
      });
    }
  }
  return results;
}

module.exports = {
  processUpload,
  persistParsedEvent,
  buildEventRecord,
  buildActivityRecord,
  buildUploadResults,
};
