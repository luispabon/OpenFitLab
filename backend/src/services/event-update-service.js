const defaultDb = require('../db');
const eventRepository = require('../repositories/event-repository');
const folderRepository = require('../repositories/folder-repository');
const { getEventById } = require('./event-query-service');
const { NotFoundError } = require('../errors');

/**
 * Assigns an event to a folder (or unfiles it). Verifies folder ownership when
 * a folderId is provided. Returns the full event object on success.
 *
 * @param {string} eventId
 * @param {string | null | undefined} folderId - UUID, null/undefined/'' to unfile
 * @param {{ db?: object, userId: string }} opts
 * @returns {Promise<object>} Full event JSON
 * @throws {NotFoundError} when folder or event is not found / not owned
 */
async function updateEventFolder(eventId, folderId, opts = {}) {
  if (!opts.userId) throw new Error('updateEventFolder requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };

  const normalizedFolderId = folderId != null && folderId !== '' ? folderId : null;

  if (normalizedFolderId !== null) {
    const folder = await folderRepository.findById(normalizedFolderId, repoOpts);
    if (!folder) throw new NotFoundError('Folder not found');
  }

  const updated = await eventRepository.updateFolderId(eventId, normalizedFolderId, repoOpts);
  if (!updated) throw new NotFoundError('Event not found');

  return getEventById(eventId, repoOpts);
}

module.exports = { updateEventFolder };
