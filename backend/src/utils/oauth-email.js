/**
 * Resolves a verified email address for a GitHub account.
 *
 * passport-github2 populates `profile.emails` with the account's primary email from
 * `GET /user/emails` without checking its `verified` flag, so that value must not be
 * trusted for account linking. This queries the API directly and returns an address
 * only when GitHub reports it as verified.
 *
 * Any failure (non-ok response, network error, unexpected payload) is treated as "no
 * verified email", so the caller falls back to the pending-signup flow rather than
 * linking an account on an unverified address.
 *
 * @param {string} accessToken GitHub access token for the authenticated user.
 * @param {typeof fetch} [fetchImpl] Fetch implementation (injectable for tests).
 * @returns {Promise<{ email: string|null, emailVerified: boolean }>}
 */
async function resolveGithubVerifiedEmail(accessToken, fetchImpl = fetch) {
  try {
    const res = await fetchImpl('https://api.github.com/user/emails', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) {
      console.error(`GitHub email lookup failed with status ${res.status}`);
      return { email: null, emailVerified: false };
    }

    const emails = await res.json();
    if (!Array.isArray(emails)) {
      console.error('GitHub email lookup returned an unexpected payload');
      return { email: null, emailVerified: false };
    }

    const chosen =
      emails.find((e) => e.primary === true && e.verified === true) ||
      emails.find((e) => e.verified === true);

    if (chosen && chosen.email) {
      return { email: chosen.email, emailVerified: true };
    }
    return { email: null, emailVerified: false };
  } catch (err) {
    console.error(`GitHub email lookup failed: ${err.message}`);
    return { email: null, emailVerified: false };
  }
}

module.exports = { resolveGithubVerifiedEmail };
