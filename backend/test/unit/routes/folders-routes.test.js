const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual, ok } = require('node:assert/strict');
const { mock } = require('node:test');
const request = require('supertest');
const express = require('express');
const { errorHandler } = require('../../../src/middleware/error-handler');

const FOLDERS_ROUTER_PATH = require.resolve('../../../src/routes/folders');
const folderService = require('../../../src/services/folder-service');

const FOLDER_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = 'u1';
    next();
  });
  app.use('/api/folders', router);
  app.use(errorHandler);
  return app;
}

function getFreshRouter() {
  delete require.cache[FOLDERS_ROUTER_PATH];
  return require('../../../src/routes/folders');
}

describe('Folders routes HTTP handler coverage', () => {
  it('GET / returns 200 with folder list', async () => {
    mock.method(folderService, 'listFolders', async () => [{ id: 'f1', name: 'Training' }]);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).get('/api/folders').expect(200);
      strictEqual(res.body.length, 1);
    } finally {
      folderService.listFolders.mock.restore();
      delete require.cache[FOLDERS_ROUTER_PATH];
    }
  });

  it('POST / returns 400 when body is missing required fields', async () => {
    const router = getFreshRouter();
    const app = createApp(router);
    const res = await request(app).post('/api/folders').send({}).expect(400);
    ok(res.body.error);
    delete require.cache[FOLDERS_ROUTER_PATH];
  });

  it('POST / returns 201 when folder created', async () => {
    mock.method(folderService, 'createFolder', async () => ({
      id: FOLDER_ID,
      name: 'Training',
      color: '#ff0000',
      pinned: false,
    }));
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app)
        .post('/api/folders')
        .send({ name: 'Training', color: '#ff0000' })
        .expect(201);
      strictEqual(res.body.id, FOLDER_ID);
    } finally {
      folderService.createFolder.mock.restore();
      delete require.cache[FOLDERS_ROUTER_PATH];
    }
  });

  it('GET /:id returns 200 when found', async () => {
    mock.method(folderService, 'getFolderById', async () => ({
      id: FOLDER_ID,
      name: 'Training',
    }));
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).get(`/api/folders/${FOLDER_ID}`).expect(200);
      strictEqual(res.body.id, FOLDER_ID);
    } finally {
      folderService.getFolderById.mock.restore();
      delete require.cache[FOLDERS_ROUTER_PATH];
    }
  });

  it('GET /:id returns 404 when not found', async () => {
    mock.method(folderService, 'getFolderById', async () => null);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).get(`/api/folders/${FOLDER_ID}`).expect(404);
      deepStrictEqual(res.body, { error: 'Folder not found' });
    } finally {
      folderService.getFolderById.mock.restore();
      delete require.cache[FOLDERS_ROUTER_PATH];
    }
  });

  it('PATCH /:id returns 200 when updated', async () => {
    mock.method(folderService, 'updateFolder', async () => ({
      id: FOLDER_ID,
      name: 'Updated',
      color: '#ff0000',
    }));
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app)
        .patch(`/api/folders/${FOLDER_ID}`)
        .send({ name: 'Updated' })
        .expect(200);
      strictEqual(res.body.id, FOLDER_ID);
    } finally {
      folderService.updateFolder.mock.restore();
      delete require.cache[FOLDERS_ROUTER_PATH];
    }
  });

  it('PATCH /:id returns 404 when not found', async () => {
    mock.method(folderService, 'updateFolder', async () => null);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app)
        .patch(`/api/folders/${FOLDER_ID}`)
        .send({ name: 'Updated' })
        .expect(404);
      deepStrictEqual(res.body, { error: 'Folder not found' });
    } finally {
      folderService.updateFolder.mock.restore();
      delete require.cache[FOLDERS_ROUTER_PATH];
    }
  });

  it('DELETE /:id returns 204 when deleted', async () => {
    mock.method(folderService, 'deleteFolder', async () => true);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      await request(app).delete(`/api/folders/${FOLDER_ID}`).expect(204);
    } finally {
      folderService.deleteFolder.mock.restore();
      delete require.cache[FOLDERS_ROUTER_PATH];
    }
  });

  it('DELETE /:id returns 404 when not found', async () => {
    mock.method(folderService, 'deleteFolder', async () => false);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).delete(`/api/folders/${FOLDER_ID}`).expect(404);
      deepStrictEqual(res.body, { error: 'Folder not found' });
    } finally {
      folderService.deleteFolder.mock.restore();
      delete require.cache[FOLDERS_ROUTER_PATH];
    }
  });
});
