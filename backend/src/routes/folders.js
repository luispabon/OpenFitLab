const express = require('express');
const {
  listFolders,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
} = require('../services/folder-service');
const {
  validateFolderId,
  validateFolderCreateBody,
  validateFolderUpdateBody,
  validateFolderDeleteQuery,
} = require('../utils/validation');
const { asyncHandler } = require('../middleware/async-handler');
const { NotFoundError } = require('../errors');

const router = express.Router();

// GET /api/folders
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const folders = await listFolders({ userId: req.userId });
    res.json(folders);
  })
);

// POST /api/folders
router.post(
  '/',
  validateFolderCreateBody,
  asyncHandler(async (req, res) => {
    const folder = await createFolder(req.body, { userId: req.userId });
    res.status(201).json(folder);
  })
);

// GET /api/folders/:id
router.get(
  '/:id',
  validateFolderId,
  asyncHandler(async (req, res) => {
    const folder = await getFolderById(req.params.id, { userId: req.userId });
    if (!folder) throw new NotFoundError('Folder not found');
    res.json(folder);
  })
);

// PATCH /api/folders/:id
router.patch(
  '/:id',
  validateFolderId,
  validateFolderUpdateBody,
  asyncHandler(async (req, res) => {
    const folder = await updateFolder(req.params.id, req.body, { userId: req.userId });
    if (!folder) throw new NotFoundError('Folder not found');
    res.json(folder);
  })
);

// DELETE /api/folders/:id
router.delete(
  '/:id',
  validateFolderId,
  validateFolderDeleteQuery,
  asyncHandler(async (req, res) => {
    const contents = req.query.contents === 'delete' ? 'delete' : 'unfile';
    const deleted = await deleteFolder(req.params.id, contents, { userId: req.userId });
    if (!deleted) throw new NotFoundError('Folder not found');
    res.status(204).send();
  })
);

module.exports = router;
