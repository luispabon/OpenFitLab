const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual, ok } = require('node:assert/strict');
const { mock } = require('node:test');
const request = require('supertest');
const express = require('express');
const { errorHandler } = require('../../../src/middleware/error-handler');

const COMPARISONS_ROUTER_PATH = require.resolve('../../../src/routes/comparisons');
const comparisonService = require('../../../src/services/comparison-service');

const COMPARISON_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
const ACTIVITY_ID_1 = 'b2c3d4e5-f6a7-4890-b123-456789abcdef';
const ACTIVITY_ID_2 = 'c3d4e5f6-a7b8-4901-c234-56789abcdef0';
const FOLDER_UUID = 'd4e5f6a7-b8c9-4012-d345-6789abcdef01';

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = 'u1';
    next();
  });
  app.use('/api/comparisons', router);
  app.use(errorHandler);
  return app;
}

function getFreshRouter() {
  delete require.cache[COMPARISONS_ROUTER_PATH];
  return require('../../../src/routes/comparisons');
}

describe('Comparisons routes HTTP handler coverage', () => {
  it('GET / returns 200 with list of comparisons', async () => {
    mock.method(comparisonService, 'getComparisons', async () => [{ id: 'c1', name: 'Test' }]);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).get('/api/comparisons').expect(200);
      strictEqual(res.body.length, 1);
      strictEqual(res.body[0].id, 'c1');
    } finally {
      comparisonService.getComparisons.mock.restore();
      delete require.cache[COMPARISONS_ROUTER_PATH];
    }
  });

  it('GET /:id returns 200 when found', async () => {
    mock.method(comparisonService, 'getComparisonById', async () => ({
      id: COMPARISON_ID,
      name: 'Test',
    }));
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).get(`/api/comparisons/${COMPARISON_ID}`).expect(200);
      strictEqual(res.body.id, COMPARISON_ID);
    } finally {
      comparisonService.getComparisonById.mock.restore();
      delete require.cache[COMPARISONS_ROUTER_PATH];
    }
  });

  it('GET /:id returns 404 when not found', async () => {
    mock.method(comparisonService, 'getComparisonById', async () => null);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).get(`/api/comparisons/${COMPARISON_ID}`).expect(404);
      deepStrictEqual(res.body, { error: 'Comparison not found' });
    } finally {
      comparisonService.getComparisonById.mock.restore();
      delete require.cache[COMPARISONS_ROUTER_PATH];
    }
  });

  it('POST / returns 400 when body is missing required fields', async () => {
    const router = getFreshRouter();
    const app = createApp(router);
    const res = await request(app).post('/api/comparisons').send({}).expect(400);
    ok(res.body.error);
    delete require.cache[COMPARISONS_ROUTER_PATH];
  });

  it('POST / returns 201 when comparison created', async () => {
    mock.method(comparisonService, 'createComparison', async () => ({
      id: COMPARISON_ID,
      name: 'New',
      eventIds: [],
      activityIds: [],
      settings: null,
      folderId: null,
      createdAt: Date.now(),
    }));
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app)
        .post('/api/comparisons')
        .send({ name: 'New', activityIds: [ACTIVITY_ID_1, ACTIVITY_ID_2] })
        .expect(201);
      strictEqual(res.body.id, COMPARISON_ID);
    } finally {
      comparisonService.createComparison.mock.restore();
      delete require.cache[COMPARISONS_ROUTER_PATH];
    }
  });

  it('DELETE /:id returns 204 when deleted', async () => {
    mock.method(comparisonService, 'deleteComparisonById', async () => true);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      await request(app).delete(`/api/comparisons/${COMPARISON_ID}`).expect(204);
    } finally {
      comparisonService.deleteComparisonById.mock.restore();
      delete require.cache[COMPARISONS_ROUTER_PATH];
    }
  });

  it('DELETE /:id returns 404 when not found', async () => {
    mock.method(comparisonService, 'deleteComparisonById', async () => false);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).delete(`/api/comparisons/${COMPARISON_ID}`).expect(404);
      deepStrictEqual(res.body, { error: 'Comparison not found' });
    } finally {
      comparisonService.deleteComparisonById.mock.restore();
      delete require.cache[COMPARISONS_ROUTER_PATH];
    }
  });

  it('PATCH /:id/folder returns 204 when updated', async () => {
    mock.method(comparisonService, 'updateComparisonFolder', async () => true);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      await request(app)
        .patch(`/api/comparisons/${COMPARISON_ID}/folder`)
        .send({ folderId: FOLDER_UUID })
        .expect(204);
    } finally {
      comparisonService.updateComparisonFolder.mock.restore();
      delete require.cache[COMPARISONS_ROUTER_PATH];
    }
  });

  it('PATCH /:id/folder returns 404 when comparison not found', async () => {
    mock.method(comparisonService, 'updateComparisonFolder', async () => false);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app)
        .patch(`/api/comparisons/${COMPARISON_ID}/folder`)
        .send({ folderId: FOLDER_UUID })
        .expect(404);
      deepStrictEqual(res.body, { error: 'Comparison not found' });
    } finally {
      comparisonService.updateComparisonFolder.mock.restore();
      delete require.cache[COMPARISONS_ROUTER_PATH];
    }
  });
});
