const { describe, it } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const {
  generateAppleState,
  setAppleStateCookie,
  clearAppleStateCookie,
  verifyAppleState,
  validateAppleUser,
  APPLE_STATE_COOKIE,
} = require('../../../src/middleware/oauth-state');

function makeRes() {
  const cookies = [];
  const cleared = [];
  let redirectedTo = null;
  return {
    cookie(name, value, options) {
      cookies.push({ name, value, options });
    },
    clearCookie(name, options) {
      cleared.push({ name, options });
    },
    redirect(url) {
      redirectedTo = url;
    },
    get cookies() {
      return cookies;
    },
    get cleared() {
      return cleared;
    },
    get redirectedTo() {
      return redirectedTo;
    },
  };
}

describe('oauth-state (Apple)', () => {
  it('generateAppleState returns a 64-char hex string', () => {
    const state = generateAppleState();
    strictEqual(typeof state, 'string');
    ok(/^[0-9a-f]{64}$/.test(state));
  });

  it('generateAppleState returns unique values', () => {
    strictEqual(generateAppleState() === generateAppleState(), false);
  });

  it('setAppleStateCookie sets the state cookie scoped to the callback path', () => {
    const res = makeRes();
    setAppleStateCookie(res, 'abc');
    strictEqual(res.cookies.length, 1);
    strictEqual(res.cookies[0].name, APPLE_STATE_COOKIE);
    strictEqual(res.cookies[0].value, 'abc');
    strictEqual(res.cookies[0].options.path, '/api/auth/apple/callback');
    strictEqual(res.cookies[0].options.httpOnly, true);
  });

  it('clearAppleStateCookie clears the cookie with matching options', () => {
    const res = makeRes();
    clearAppleStateCookie(res);
    strictEqual(res.cleared.length, 1);
    strictEqual(res.cleared[0].name, APPLE_STATE_COOKIE);
  });

  describe('verifyAppleState', () => {
    function makeReq(cookieHeader, body) {
      return { headers: { cookie: cookieHeader }, body };
    }

    it('redirects to the login failure page when the cookie is missing', () => {
      const req = makeReq(undefined, { state: 'x'.repeat(64) });
      const res = makeRes();
      let nextCalled = false;
      verifyAppleState(req, res, () => {
        nextCalled = true;
      });
      strictEqual(nextCalled, false);
      ok(res.redirectedTo.includes('/#/login?error=apple'));
      strictEqual(res.cleared.length, 1);
    });

    it('redirects when the posted state is missing', () => {
      const state = generateAppleState();
      const req = makeReq(`${APPLE_STATE_COOKIE}=${state}`, {});
      const res = makeRes();
      let nextCalled = false;
      verifyAppleState(req, res, () => {
        nextCalled = true;
      });
      strictEqual(nextCalled, false);
      ok(res.redirectedTo.includes('error=apple'));
    });

    it('redirects when cookie and posted state mismatch', () => {
      const state = generateAppleState();
      const other = generateAppleState();
      const req = makeReq(`${APPLE_STATE_COOKIE}=${state}`, { state: other });
      const res = makeRes();
      let nextCalled = false;
      verifyAppleState(req, res, () => {
        nextCalled = true;
      });
      strictEqual(nextCalled, false);
      ok(res.redirectedTo.includes('error=apple'));
    });

    it('rejects a replayed state cookie value used again after being cleared (no state persistence beyond one verify call)', () => {
      const state = generateAppleState();
      const req1 = makeReq(`${APPLE_STATE_COOKIE}=${state}`, { state });
      const res1 = makeRes();
      let next1 = false;
      verifyAppleState(req1, res1, () => {
        next1 = true;
      });
      strictEqual(next1, true);
      strictEqual(res1.cleared.length, 1);

      // Simulate replay: attacker resends the same body state without the cookie
      // (since it was cleared and is HttpOnly, they cannot resend a valid cookie).
      const req2 = makeReq(undefined, { state });
      const res2 = makeRes();
      let next2 = false;
      verifyAppleState(req2, res2, () => {
        next2 = true;
      });
      strictEqual(next2, false);
    });

    it('calls next() and clears the cookie when cookie and posted state match', () => {
      const state = generateAppleState();
      const req = makeReq(`${APPLE_STATE_COOKIE}=${state}`, { state });
      const res = makeRes();
      let nextCalled = false;
      verifyAppleState(req, res, () => {
        nextCalled = true;
      });
      strictEqual(nextCalled, true);
      strictEqual(res.redirectedTo, null);
      strictEqual(res.cleared.length, 1);
    });

    it('does not throw when an unrelated cookie has malformed %-encoding', () => {
      const state = generateAppleState();
      const req = makeReq(`junk=%E0%A4%A; ${APPLE_STATE_COOKIE}=${state}`, { state });
      const res = makeRes();
      let nextCalled = false;
      verifyAppleState(req, res, () => {
        nextCalled = true;
      });
      strictEqual(nextCalled, true);
    });

    it('handles a non-string posted state without throwing', () => {
      const state = generateAppleState();
      const req = makeReq(`${APPLE_STATE_COOKIE}=${state}`, { state: ['a', 'b'] });
      const res = makeRes();
      let nextCalled = false;
      verifyAppleState(req, res, () => {
        nextCalled = true;
      });
      strictEqual(nextCalled, false);
      ok(res.redirectedTo.includes('error=apple'));
    });
  });

  describe('validateAppleUser', () => {
    it('calls next() when user field is absent', () => {
      const req = { body: {} };
      const res = makeRes();
      let nextCalled = false;
      validateAppleUser(req, res, () => {
        nextCalled = true;
      });
      strictEqual(nextCalled, true);
    });

    it('calls next() when user field is valid JSON', () => {
      const req = { body: { user: JSON.stringify({ name: { firstName: 'A' } }) } };
      const res = makeRes();
      let nextCalled = false;
      validateAppleUser(req, res, () => {
        nextCalled = true;
      });
      strictEqual(nextCalled, true);
    });

    it('redirects to failure when user field is malformed JSON', () => {
      const req = { body: { user: '{not json' } };
      const res = makeRes();
      let nextCalled = false;
      validateAppleUser(req, res, () => {
        nextCalled = true;
      });
      strictEqual(nextCalled, false);
      ok(res.redirectedTo.includes('error=apple'));
    });

    it('redirects to failure when user field is not a string (e.g. user[name]=x parsed as object)', () => {
      const req = { body: { user: { name: 'x' } } };
      const res = makeRes();
      let nextCalled = false;
      validateAppleUser(req, res, () => {
        nextCalled = true;
      });
      strictEqual(nextCalled, false);
      ok(res.redirectedTo.includes('error=apple'));
    });
  });
});
