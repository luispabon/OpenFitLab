const { describe, it } = require('node:test');
const { strictEqual } = require('node:assert/strict');

const { resolveGithubVerifiedEmail } = require('../../src/utils/oauth-email');

function fetchReturning(body, ok = true) {
  return async () => ({ ok, json: async () => body });
}

describe('resolveGithubVerifiedEmail', () => {
  it('returns the verified primary email', async () => {
    const fetchImpl = fetchReturning([
      { email: 'primary@example.com', primary: true, verified: true },
      { email: 'other@example.com', primary: false, verified: true },
    ]);
    const result = await resolveGithubVerifiedEmail('token', fetchImpl);
    strictEqual(result.email, 'primary@example.com');
    strictEqual(result.emailVerified, true);
  });

  it('falls back to the first verified email when the primary is unverified', async () => {
    const fetchImpl = fetchReturning([
      { email: 'primary@example.com', primary: true, verified: false },
      { email: 'verified@example.com', primary: false, verified: true },
    ]);
    const result = await resolveGithubVerifiedEmail('token', fetchImpl);
    strictEqual(result.email, 'verified@example.com');
    strictEqual(result.emailVerified, true);
  });

  it('does not trust an unverified primary email', async () => {
    const fetchImpl = fetchReturning([
      { email: 'victim@example.com', primary: true, verified: false },
    ]);
    const result = await resolveGithubVerifiedEmail('token', fetchImpl);
    strictEqual(result.email, null);
    strictEqual(result.emailVerified, false);
  });

  it('returns no email when the response is not ok', async () => {
    const result = await resolveGithubVerifiedEmail('token', fetchReturning([], false));
    strictEqual(result.email, null);
    strictEqual(result.emailVerified, false);
  });

  it('returns no email when the request throws', async () => {
    const fetchImpl = async () => {
      throw new Error('network');
    };
    const result = await resolveGithubVerifiedEmail('token', fetchImpl);
    strictEqual(result.email, null);
    strictEqual(result.emailVerified, false);
  });

  it('returns no email when the payload is not an array', async () => {
    const result = await resolveGithubVerifiedEmail('token', fetchReturning({ message: 'nope' }));
    strictEqual(result.email, null);
    strictEqual(result.emailVerified, false);
  });

  it('ignores a verified entry with no email address', async () => {
    const fetchImpl = fetchReturning([{ email: '', primary: true, verified: true }]);
    const result = await resolveGithubVerifiedEmail('token', fetchImpl);
    strictEqual(result.email, null);
    strictEqual(result.emailVerified, false);
  });

  it('returns no email when reading the response body fails', async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => {
        throw new Error('bad json');
      },
    });
    const result = await resolveGithubVerifiedEmail('token', fetchImpl);
    strictEqual(result.email, null);
    strictEqual(result.emailVerified, false);
  });
});
