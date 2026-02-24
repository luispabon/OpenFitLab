const express = require('express');
const multer = require('multer');
const FileParser = require('../parsers/file-parser');
const {
  listEvents,
  getEventById,
  getActivityRows,
  getComparisonCandidates,
} = require('../services/event-query-service');
const { processUpload } = require('../services/event-upload-service');
const { deleteEventById } = require('../services/event-delete-service');
const { getStreamsForActivity } = require('../services/stream-service');
const { updateActivity } = require('../services/activity-service');

const { asyncHandler } = require('../middleware/async-handler');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB limit
});

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
    const events = await listEvents(
      {
        startDate: req.query.startDate != null ? Number(req.query.startDate) : undefined,
        endDate: req.query.endDate != null ? Number(req.query.endDate) : undefined,
        limit: req.query.limit,
      },
      { userId: req.userId }
    );
    res.json(events);
  })
);

// GET /api/events/activity-rows?limit=&offset=&startDate=&endDate=&activityTypes=&devices=&search=
router.get(
  '/activity-rows',
  validateGetActivityRowsQuery,
  asyncHandler(async (req, res) => {
    const result = await getActivityRows(
      {
        limit: req.query.limit,
        offset: req.query.offset,
        startDate: req.query.startDate != null ? Number(req.query.startDate) : undefined,
        endDate: req.query.endDate != null ? Number(req.query.endDate) : undefined,
        activityTypes: req.query.activityTypes,
        devices: req.query.devices,
        search: req.query.search,
      },
      { userId: req.userId }
    );
    res.json(result);
  })
);

// GET /api/events/:id/candidates (must come before /:id route)
router.get(
  '/:id/candidates',
  validateEventId,
  asyncHandler(async (req, res) => {
    const events = await getComparisonCandidates(req.params.id, { userId: req.userId });
    if (events === null) return res.status(404).json({ error: 'Event not found' });
    res.json(events);
  })
);

// GET /api/events/:id
router.get(
  '/:id',
  validateEventId,
  asyncHandler(async (req, res) => {
    const result = await getEventById(req.params.id, { userId: req.userId });
    if (!result) return res.status(404).json({ error: 'Event not found' });
    res.json(result);
  })
);

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
      primaryFile.originalname || 'file',
      { userId: req.userId }
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
    const types = req.query.types
      ? Array.isArray(req.query.types)
        ? req.query.types
        : [req.query.types]
      : undefined;
    const streams = await getStreamsForActivity(eventId, activityId, types ? { types } : {}, {
      userId: req.userId,
    });
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

    if (
      (typeUpdate === undefined || typeUpdate === null) &&
      (deviceName === undefined || deviceName === null)
    ) {
      return res.status(400).json({ error: 'Provide at least one of type or deviceName' });
    }

    const activity = await updateActivity(
      eventId,
      activityId,
      { type: typeUpdate, deviceName },
      { userId: req.userId }
    );
    if (!activity) return res.status(404).json({ error: 'Activity not found' });
    res.json(activity);
  })
);

// DELETE /api/events/:id
router.delete(
  '/:id',
  validateEventId,
  asyncHandler(async (req, res) => {
    const deleted = await deleteEventById(req.params.id, { userId: req.userId });
    if (!deleted) return res.status(404).json({ error: 'Event not found' });
    res.status(204).send();
  })
);

module.exports = router;
