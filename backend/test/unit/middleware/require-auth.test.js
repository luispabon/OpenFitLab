const { describe, it, mock } = require('node:test');
const { strictEqual, deepStrictEqual } = require('node:assert/strict');
const { requireAuth } = require('../../../src/middleware/require-auth');
const userRepository = require('../../../src/repositories/user-repository');

function makeFakeRes() {
  let statusCode = null;
  let body = null;
  const clearedCookies = [];
  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      body = data;
      return res;
    },
    clearCookie(name, opts) {
      clearedCookies.push({ name, opts });
      return res;
    },
    getStatusCode: () => statusCode,
    getBody: () => body,
    getClearedCookies: () => clearedCookies,
  };
  return res;
}

function mockUser(user) {
  return mock.method(userRepository, 'findById', async () => user);
}

async function invoke(req) {
  const res = makeFakeRes();
  const nextCalls = [];
  await requireAuth(req, res, (err) => nextCalls.push(err));
  return { res, nextCalls };
}

describe('require-auth middleware', () => {
  it('returns 401 when session is missing', async () => {
    const findById = mockUser({ id: 'user-123' });
    try {
      const { res, nextCalls } = await invoke({});

      strictEqual(res.getStatusCode(), 401);
      deepStrictEqual(res.getBody(), { error: 'Authentication required' });
      strictEqual(nextCalls.length, 0);
      strictEqual(findById.mock.callCount(), 0);
    } finally {
      findById.mock.restore();
    }
  });

  it('returns 401 when session exists but userId is missing', async () => {
    const findById = mockUser({ id: 'user-123' });
    try {
      const { res, nextCalls } = await invoke({ session: {} });

      strictEqual(res.getStatusCode(), 401);
      strictEqual(nextCalls.length, 0);
      strictEqual(findById.mock.callCount(), 0);
    } finally {
      findById.mock.restore();
    }
  });

  it('returns 401 when session.userId is null', async () => {
    const findById = mockUser({ id: 'user-123' });
    try {
      const { res, nextCalls } = await invoke({ session: { userId: null } });

      strictEqual(res.getStatusCode(), 401);
      strictEqual(nextCalls.length, 0);
      strictEqual(findById.mock.callCount(), 0);
    } finally {
      findById.mock.restore();
    }
  });

  it('returns 401 when session.userId is undefined', async () => {
    const findById = mockUser({ id: 'user-123' });
    try {
      const { res, nextCalls } = await invoke({ session: { userId: undefined } });

      strictEqual(res.getStatusCode(), 401);
      strictEqual(nextCalls.length, 0);
      strictEqual(findById.mock.callCount(), 0);
    } finally {
      findById.mock.restore();
    }
  });

  it('returns 401 when session.userId is empty string', async () => {
    const findById = mockUser({ id: 'user-123' });
    try {
      const { res, nextCalls } = await invoke({ session: { userId: '' } });

      strictEqual(res.getStatusCode(), 401);
      strictEqual(nextCalls.length, 0);
      strictEqual(findById.mock.callCount(), 0);
    } finally {
      findById.mock.restore();
    }
  });

  it('calls next and sets req.userId when session has valid userId and the user exists', async () => {
    const findById = mockUser({ id: 'user-123' });
    const req = { session: { userId: 'user-123' } };
    try {
      const { res, nextCalls } = await invoke(req);

      strictEqual(nextCalls.length, 1);
      strictEqual(req.userId, 'user-123');
      strictEqual(res.getStatusCode(), null);
      strictEqual(findById.mock.callCount(), 1);
      strictEqual(findById.mock.calls[0].arguments[0], 'user-123');
    } finally {
      findById.mock.restore();
    }
  });

  it('returns 401, destroys the stale session, and clears the cookie when the user no longer exists', async () => {
    const findById = mockUser(null);
    let destroyCalled = false;
    const req = {
      session: {
        userId: 'user-123',
        destroy(cb) {
          destroyCalled = true;
          cb(null);
        },
      },
    };
    try {
      const { res, nextCalls } = await invoke(req);

      strictEqual(res.getStatusCode(), 401);
      deepStrictEqual(res.getBody(), { error: 'Authentication required' });
      strictEqual(nextCalls.length, 0);
      strictEqual(req.userId, undefined);
      strictEqual(destroyCalled, true);
      deepStrictEqual(res.getClearedCookies(), [{ name: 'ofl.sid', opts: { path: '/' } }]);
    } finally {
      findById.mock.restore();
    }
  });

  it('still returns 401 when destroying the stale session fails', async () => {
    const findById = mockUser(null);
    const req = {
      session: {
        userId: 'user-123',
        destroy(cb) {
          cb(new Error('session store unavailable'));
        },
      },
    };
    try {
      const { res, nextCalls } = await invoke(req);

      strictEqual(res.getStatusCode(), 401);
      deepStrictEqual(res.getBody(), { error: 'Authentication required' });
      strictEqual(nextCalls.length, 0);
      deepStrictEqual(res.getClearedCookies(), [{ name: 'ofl.sid', opts: { path: '/' } }]);
    } finally {
      findById.mock.restore();
    }
  });

  it('fails closed by passing user lookup errors to next', async () => {
    const findById = mock.method(userRepository, 'findById', async () => {
      throw new Error('db unavailable');
    });
    try {
      const { res, nextCalls } = await invoke({ session: { userId: 'user-123' } });

      strictEqual(nextCalls.length, 1);
      strictEqual(nextCalls[0].message, 'db unavailable');
      strictEqual(res.getStatusCode(), null);
    } finally {
      findById.mock.restore();
    }
  });

  it('preserves existing req properties when attaching userId', async () => {
    const findById = mockUser({ id: 'u1' });
    const req = { session: { userId: 'u1' }, params: { id: 'abc' } };
    try {
      await invoke(req);

      strictEqual(req.userId, 'u1');
      strictEqual(req.params.id, 'abc');
    } finally {
      findById.mock.restore();
    }
  });
});
