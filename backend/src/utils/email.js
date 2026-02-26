/**
 * Normalize email for consistent storage and lookup (e.g. account linking).
 * @param {string | null | undefined} email
 * @returns {string | null} Normalized email or null if not a non-empty string.
 */
function normalizeEmail(email) {
  if (email == null || typeof email !== 'string') return null;
  const trimmed = email.trim();
  return trimmed === '' ? null : trimmed.toLowerCase();
}

module.exports = { normalizeEmail };
