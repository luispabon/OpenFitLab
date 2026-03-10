const { describe, it } = require('node:test');
const { strictEqual } = require('node:assert/strict');
const { mock } = require('node:test');
const request = require('supertest');
const express = require('express');
const { errorHandler } = require('../../../src/middleware/error-handler');

const META_ROUTER_PATH = require.resolve('../../../src/routes/meta');
const metaService = require('../../../src/services/meta-service');

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = 'u1';
    next();
  });
  app.use('/api', router);
  app.use(errorHandler);
  return app;
}

function getFreshRouter() {
  delete require.cache[META_ROUTER_PATH];
  return require('../../../src/routes/meta');
}

describe('Meta routes HTTP handler coverage', () => {
  it('GET /activity-types returns 200 with types array', async () => {
    mock.method(metaService, 'getActivityTypes', async () => ['Running', 'Cycling']);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).get('/api/activity-types').expect(200);
      strictEqual(res.body.length, 2);
      strictEqual(res.body[0], 'Running');
    } finally {
      metaService.getActivityTypes.mock.restore();
      delete require.cache[META_ROUTER_PATH];
    }
  });

  it('GET /devices returns 200 with devices array', async () => {
    mock.method(metaService, 'getDevices', async () => ['Garmin', 'Polar']);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).get('/api/devices').expect(200);
      strictEqual(res.body.length, 2);
      strictEqual(res.body[0], 'Garmin');
    } finally {
      metaService.getDevices.mock.restore();
      delete require.cache[META_ROUTER_PATH];
    }
  });

  it('GET /activity-types passes userId to service', async () => {
    let capturedOpts;
    mock.method(metaService, 'getActivityTypes', async (opts) => {
      capturedOpts = opts;
      return [];
    });
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      await request(app).get('/api/activity-types').expect(200);
      strictEqual(capturedOpts.userId, 'u1');
    } finally {
      metaService.getActivityTypes.mock.restore();
      delete require.cache[META_ROUTER_PATH];
    }
  });

  it('GET /devices passes userId to service', async () => {
    let capturedOpts;
    mock.method(metaService, 'getDevices', async (opts) => {
      capturedOpts = opts;
      return [];
    });
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      await request(app).get('/api/devices').expect(200);
      strictEqual(capturedOpts.userId, 'u1');
    } finally {
      metaService.getDevices.mock.restore();
      delete require.cache[META_ROUTER_PATH];
    }
  });
});
