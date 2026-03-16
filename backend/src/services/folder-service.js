const { randomUUID } = require('crypto');
const defaultDb = require('../db');
const folderRepository = require('../repositories/folder-repository');
const eventRepository = require('../repositories/event-repository');
const comparisonRepository = require('../repositories/comparison-repository');
const { ValidationError } = require('../errors');

const MAX_FOLDERS_PER_USER = 20;
const MAX_PINNED_FOLDERS = 5;

function mapFolderRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    pinned: Boolean(row.pinned),
    ...(row.created_at != null ? { createdAt: new Date(row.created_at).getTime() } : {}),
  };
}

async function listFolders(opts = {}) {
  if (!opts.userId) throw new Error('listFolders requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const rows = await folderRepository.listAll(opts.userId, repoOpts);
  const folders = rows.map(mapFolderRow);
  if (folders.length === 0) return [];
  const folderIds = folders.map((f) => f.id);
  const [eventCounts, comparisonCounts] = await Promise.all([
    folderRepository.getEventCountsByFolderIds(folderIds, repoOpts),
    folderRepository.getComparisonCountsByFolderIds(folderIds, repoOpts),
  ]);
  for (const f of folders) {
    f.eventCount = eventCounts[f.id] ?? 0;
    f.comparisonCount = comparisonCounts[f.id] ?? 0;
  }
  return folders;
}

async function getFolderById(id, opts = {}) {
  if (!opts.userId) throw new Error('getFolderById requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };
  const row = await folderRepository.findById(id, repoOpts);
  if (!row) return null;
  const folder = mapFolderRow(row);
  const [eventCounts, comparisonCounts] = await Promise.all([
    folderRepository.getEventCountsByFolderIds([id], repoOpts),
    folderRepository.getComparisonCountsByFolderIds([id], repoOpts),
  ]);
  folder.eventCount = eventCounts[id] ?? 0;
  folder.comparisonCount = comparisonCounts[id] ?? 0;
  return folder;
}

async function createFolder(body, opts = {}) {
  if (!opts.userId) throw new Error('createFolder requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };

  const count = await folderRepository.countByUserId(opts.userId, repoOpts);
  if (count >= MAX_FOLDERS_PER_USER) {
    throw new ValidationError(`Maximum ${MAX_FOLDERS_PER_USER} folders allowed`);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) throw new ValidationError('name must be a non-empty string');

  const existing = await folderRepository.findByNameForUser(name, opts.userId, repoOpts);
  if (existing) throw new ValidationError('You already have a folder with this name');

  const color = typeof body.color === 'string' ? body.color.trim() : '#6b7280';
  const id = randomUUID();
  await folderRepository.create({ id, name, color, pinned: false }, repoOpts);
  return getFolderById(id, repoOpts);
}

async function updateFolder(id, body, opts = {}) {
  if (!opts.userId) throw new Error('updateFolder requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };

  const existing = await folderRepository.findById(id, repoOpts);
  if (!existing) return null;

  const updates = {};
  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ValidationError('name must be a non-empty string');
    const byName = await folderRepository.findByNameForUser(name, opts.userId, repoOpts);
    if (byName && byName.id !== id)
      throw new ValidationError('You already have a folder with this name');
    updates.name = name;
  }
  if (body.color !== undefined) {
    updates.color = typeof body.color === 'string' ? body.color.trim() : existing.color;
  }
  if (body.pinned !== undefined) {
    const pinned = Boolean(body.pinned);
    if (pinned) {
      const pinnedCount = await folderRepository.countPinnedByUserId(opts.userId, repoOpts);
      if (!existing.pinned && pinnedCount >= MAX_PINNED_FOLDERS) {
        throw new ValidationError(`Maximum ${MAX_PINNED_FOLDERS} pinned folders allowed`);
      }
    }
    updates.pinned = pinned;
  }

  if (Object.keys(updates).length > 0) {
    await folderRepository.update(id, updates, repoOpts);
  }
  return getFolderById(id, repoOpts);
}

async function deleteFolder(id, contentsMode, opts = {}) {
  if (!opts.userId) throw new Error('deleteFolder requires opts.userId');
  const db = opts.db ?? defaultDb;
  const repoOpts = { ...opts, db };

  const existing = await folderRepository.findById(id, repoOpts);
  if (!existing) return false;

  if (contentsMode === 'delete') {
    return db.transaction(async (conn) => {
      const txOpts = { ...repoOpts, conn };
      const eventIds = await folderRepository.findEventIdsByFolderId(id, txOpts);
      for (const eventId of eventIds) {
        const linked = await comparisonRepository.findByEventIds([eventId], txOpts);
        if (linked.length > 0) {
          await comparisonRepository.deleteByIds(
            linked.map((c) => c.id),
            txOpts
          );
        }
        await eventRepository.deleteById(eventId, txOpts);
      }
      await folderRepository.deleteComparisonsByFolderId(id, txOpts);
      return folderRepository.deleteById(id, txOpts);
    });
  }

  return db.transaction(async (conn) => {
    const txOpts = { ...repoOpts, conn };
    await folderRepository.clearEventsFolderId(id, txOpts);
    await folderRepository.clearComparisonsFolderId(id, txOpts);
    return folderRepository.deleteById(id, txOpts);
  });
}

module.exports = {
  listFolders,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
  MAX_FOLDERS_PER_USER,
  MAX_PINNED_FOLDERS,
};
