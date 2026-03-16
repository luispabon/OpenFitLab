const express = require('express');
const multer = require('multer');
const {
  listEvents,
  getEventById,
  getActivityRows,
  getComparisonCandidates,
} = require('../services/event-query-service');
const { processUpload, buildUploadResults } = require('../services/event-upload-service');
const { deleteEventById } = require('../services/event-delete-service');
const { getStreamsForActivity } = require('../services/stream-service');
const { updateActivity } = require('../services/activity-service');
const { updateEventFolder } = require('../services/event-update-service');
const { asyncHandler } = require('../middleware/async-handler');
const { uploadLimiter } = require('../middleware/rate-limit');
const { ValidationError, NotFoundError } = require('../errors');

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
  isValidUUID,
} = require('../utils/validation');

// GET /api/events?startDate=&endDate=&limit=&folderId=
router.get(
  '/',
  validateGetEventsQuery,
  asyncHandler(async (req, res) => {
    const folderId = req.query.folderId;
    const events = await listEvents(
      {
        startDate: req.query.startDate != null ? Number(req.query.startDate) : undefined,
        endDate: req.query.endDate != null ? Number(req.query.endDate) : undefined,
        limit: req.query.limit,
        folderId: folderId === 'unfiled' || folderId === '' ? 'unfiled' : folderId,
      },
      { userId: req.userId }
    );
    res.json(events);
  })
);

// GET /api/events/activity-rows?limit=&offset=&startDate=&endDate=&activityTypes=&devices=&search=&folderId=
router.get(
  '/activity-rows',
  validateGetActivityRowsQuery,
  asyncHandler(async (req, res) => {
    const folderId = req.query.folderId;
    const result = await getActivityRows(
      {
        limit: req.query.limit,
        offset: req.query.offset,
        startDate: req.query.startDate != null ? Number(req.query.startDate) : undefined,
        endDate: req.query.endDate != null ? Number(req.query.endDate) : undefined,
        activityTypes: req.query.activityTypes,
        devices: req.query.devices,
        search: req.query.search,
        folderId: folderId === 'unfiled' || folderId === '' ? 'unfiled' : folderId,
      },
      { userId: req.userId }
    );
    res.json(result);
  })
);

// GET /api/events/:id/candidates?sameFolderOnly=true|false (must come before /:id route)
router.get(
  '/:id/candidates',
  validateEventId,
  asyncHandler(async (req, res) => {
    const sameFolderOnly = req.query.sameFolderOnly !== 'false';
    const events = await getComparisonCandidates(req.params.id, {
      userId: req.userId,
      sameFolderOnly,
    });
    if (events === null) throw new NotFoundError('Event not found');
    res.json(events);
  })
);

// GET /api/events/:id
router.get(
  '/:id',
  validateEventId,
  asyncHandler(async (req, res) => {
    const result = await getEventById(req.params.id, { userId: req.userId });
    if (!result) throw new NotFoundError('Event not found');
    res.json(result);
  })
);

// POST /api/events (multipart: files, optional folderId in body; response always { results })
router.post(
  '/',
  uploadLimiter,
  upload.array('files', 10),
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      throw new ValidationError('No files provided');
    }
    const folderId = req.body?.folderId;
    if (folderId != null && folderId !== '') {
      if (!isValidUUID(folderId)) {
        throw new ValidationError('folderId must be a valid UUID');
      }
    }
    const results = await buildUploadResults(req.files, req.userId, processUpload, {
      folderId: folderId ?? null,
    });
    res.status(201).json({ results });
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
      throw new ValidationError('Provide at least one of type or deviceName');
    }

    const activity = await updateActivity(
      eventId,
      activityId,
      { type: typeUpdate, deviceName },
      { userId: req.userId }
    );
    if (!activity) throw new NotFoundError('Activity not found');
    res.json(activity);
  })
);

// PATCH /api/events/:id (update event folder)
router.patch(
  '/:id',
  validateEventId,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { folderId } = req.body || {};
    if (folderId !== undefined && folderId !== null && folderId !== '') {
      if (!isValidUUID(folderId)) {
        throw new ValidationError('folderId must be a valid UUID or null');
      }
    }
    const result = await updateEventFolder(id, folderId, { userId: req.userId });
    res.json(result);
  })
);

// DELETE /api/events/:id
router.delete(
  '/:id',
  validateEventId,
  asyncHandler(async (req, res) => {
    const deleted = await deleteEventById(req.params.id, { userId: req.userId });
    if (!deleted) throw new NotFoundError('Event not found');
    res.status(204).send();
  })
);

module.exports = router;
