const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const { mock } = require('node:test');
const request = require('supertest');
const express = require('express');
const { errorHandler } = require('../../../src/middleware/error-handler');

const ACCOUNT_ROUTER_PATH = require.resolve('../../../src/routes/account');
const accountService = require('../../../src/services/account-service');

function createApp(router) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = 'u1';
    next();
  });
  app.use('/api/account', router);
  app.use(errorHandler);
  return app;
}

function getFreshRouter() {
  delete require.cache[ACCOUNT_ROUTER_PATH];
  return require('../../../src/routes/account');
}

describe('Account routes HTTP handler coverage', () => {
  it('GET /export returns 200 with user data', async () => {
    mock.method(accountService, 'exportUserData', async () => ({
      user: { id: 'u1' },
      events: [],
    }));
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).get('/api/account/export').expect(200);
      strictEqual(res.body.user.id, 'u1');
    } finally {
      accountService.exportUserData.mock.restore();
      delete require.cache[ACCOUNT_ROUTER_PATH];
    }
  });

  it('GET /export returns 404 when user not found', async () => {
    mock.method(accountService, 'exportUserData', async () => null);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).get('/api/account/export').expect(404);
      deepStrictEqual(res.body, { error: 'User not found' });
    } finally {
      accountService.exportUserData.mock.restore();
      delete require.cache[ACCOUNT_ROUTER_PATH];
    }
  });

  it('GET /export with includeStreams=true passes flag to service', async () => {
    let capturedOpts;
    mock.method(accountService, 'exportUserData', async (userId, opts) => {
      capturedOpts = opts;
      return { user: { id: 'u1' }, events: [] };
    });
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      await request(app).get('/api/account/export?includeStreams=true').expect(200);
      strictEqual(capturedOpts.includeStreams, true);
    } finally {
      accountService.exportUserData.mock.restore();
      delete require.cache[ACCOUNT_ROUTER_PATH];
    }
  });

  it('GET /export with includeStreams=false passes false flag to service', async () => {
    let capturedOpts;
    mock.method(accountService, 'exportUserData', async (userId, opts) => {
      capturedOpts = opts;
      return { user: { id: 'u1' }, events: [] };
    });
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      await request(app).get('/api/account/export?includeStreams=false').expect(200);
      strictEqual(capturedOpts.includeStreams, false);
    } finally {
      accountService.exportUserData.mock.restore();
      delete require.cache[ACCOUNT_ROUTER_PATH];
    }
  });

  it('DELETE / returns 204 when account deleted', async () => {
    mock.method(accountService, 'deleteAccount', async () => true);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      await request(app).delete('/api/account').expect(204);
    } finally {
      accountService.deleteAccount.mock.restore();
      delete require.cache[ACCOUNT_ROUTER_PATH];
    }
  });

  it('DELETE / returns 404 when user not found', async () => {
    mock.method(accountService, 'deleteAccount', async () => false);
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).delete('/api/account').expect(404);
      deepStrictEqual(res.body, { error: 'User not found' });
    } finally {
      accountService.deleteAccount.mock.restore();
      delete require.cache[ACCOUNT_ROUTER_PATH];
    }
  });
});
