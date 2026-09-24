const { describe, it } = require('node:test');
const { strictEqual, deepStrictEqual, ok } = require('node:assert/strict');
const { mock } = require('node:test');
const request = require('supertest');
const express = require('express');
const { errorHandler } = require('../../../src/middleware/error-handler');

const ACCOUNT_ROUTER_PATH = require.resolve('../../../src/routes/account');
const accountService = require('../../../src/services/account-service');
const authService = require('../../../src/services/auth-service');
const sessionRegistry = require('../../../src/session-registry');

function createApp(router, { sessionDestroy } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.userId = 'u1';
    req.session = {
      destroy: sessionDestroy ?? ((cb) => cb(null)),
    };
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

  it('DELETE / returns 204, destroys the session before revoking others, and clears the cookie', async () => {
    mock.method(accountService, 'deleteAccount', async () => true);
    const calls = [];
    mock.method(authService, 'destroySession', async () => {
      calls.push('destroySession');
    });
    let revokedUserId;
    mock.method(sessionRegistry, 'revokeUserSessions', async (userId) => {
      calls.push('revokeUserSessions');
      revokedUserId = userId;
    });
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).delete('/api/account').expect(204);
      strictEqual(revokedUserId, 'u1');
      deepStrictEqual(calls, ['destroySession', 'revokeUserSessions']);
      ok(res.headers['set-cookie'].some((c) => c.startsWith('ofl.sid=;')));
    } finally {
      accountService.deleteAccount.mock.restore();
      authService.destroySession.mock.restore();
      sessionRegistry.revokeUserSessions.mock.restore();
      delete require.cache[ACCOUNT_ROUTER_PATH];
    }
  });

  it('DELETE / still revokes other sessions and returns 204 when destroying the session fails', async () => {
    mock.method(accountService, 'deleteAccount', async () => true);
    mock.method(authService, 'destroySession', async () => {
      throw new Error('session store unavailable');
    });
    let revokedUserId = null;
    mock.method(sessionRegistry, 'revokeUserSessions', async (userId) => {
      revokedUserId = userId;
    });
    const errorLog = mock.method(console, 'error', () => {});
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).delete('/api/account').expect(204);
      strictEqual(revokedUserId, 'u1');
      ok(res.headers['set-cookie'].some((c) => c.startsWith('ofl.sid=;')));
      strictEqual(errorLog.mock.callCount(), 1);
    } finally {
      accountService.deleteAccount.mock.restore();
      authService.destroySession.mock.restore();
      sessionRegistry.revokeUserSessions.mock.restore();
      errorLog.mock.restore();
      delete require.cache[ACCOUNT_ROUTER_PATH];
    }
  });

  it('DELETE / still destroys the session and returns 204 when revoking other sessions fails', async () => {
    mock.method(accountService, 'deleteAccount', async () => true);
    let destroyCalled = false;
    mock.method(authService, 'destroySession', async () => {
      destroyCalled = true;
    });
    mock.method(sessionRegistry, 'revokeUserSessions', async () => {
      throw new Error('valkey unavailable');
    });
    const errorLog = mock.method(console, 'error', () => {});
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).delete('/api/account').expect(204);
      strictEqual(destroyCalled, true);
      ok(res.headers['set-cookie'].some((c) => c.startsWith('ofl.sid=;')));
      strictEqual(errorLog.mock.callCount(), 1);
    } finally {
      accountService.deleteAccount.mock.restore();
      authService.destroySession.mock.restore();
      sessionRegistry.revokeUserSessions.mock.restore();
      errorLog.mock.restore();
      delete require.cache[ACCOUNT_ROUTER_PATH];
    }
  });

  it('DELETE / attempts both cleanup steps and returns 204 when both fail', async () => {
    mock.method(accountService, 'deleteAccount', async () => true);
    mock.method(authService, 'destroySession', async () => {
      throw new Error('session store unavailable');
    });
    mock.method(sessionRegistry, 'revokeUserSessions', async () => {
      throw new Error('valkey unavailable');
    });
    const errorLog = mock.method(console, 'error', () => {});
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).delete('/api/account').expect(204);
      strictEqual(authService.destroySession.mock.callCount(), 1);
      strictEqual(sessionRegistry.revokeUserSessions.mock.callCount(), 1);
      ok(res.headers['set-cookie'].some((c) => c.startsWith('ofl.sid=;')));
      strictEqual(errorLog.mock.callCount(), 1);
    } finally {
      accountService.deleteAccount.mock.restore();
      authService.destroySession.mock.restore();
      sessionRegistry.revokeUserSessions.mock.restore();
      errorLog.mock.restore();
      delete require.cache[ACCOUNT_ROUTER_PATH];
    }
  });

  it('DELETE / returns 404 when user not found and does not revoke sessions', async () => {
    mock.method(accountService, 'deleteAccount', async () => false);
    mock.method(authService, 'destroySession', async () => {});
    mock.method(sessionRegistry, 'revokeUserSessions', async () => {});
    try {
      const router = getFreshRouter();
      const app = createApp(router);
      const res = await request(app).delete('/api/account').expect(404);
      deepStrictEqual(res.body, { error: 'User not found' });
      strictEqual(authService.destroySession.mock.callCount(), 0);
      strictEqual(sessionRegistry.revokeUserSessions.mock.callCount(), 0);
    } finally {
      accountService.deleteAccount.mock.restore();
      authService.destroySession.mock.restore();
      sessionRegistry.revokeUserSessions.mock.restore();
      delete require.cache[ACCOUNT_ROUTER_PATH];
    }
  });
});
