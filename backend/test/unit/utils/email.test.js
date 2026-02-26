const { describe, it } = require('node:test');
const { strictEqual } = require('node:assert/strict');
const { normalizeEmail } = require('../../../src/utils/email');

describe('email', () => {
  describe('normalizeEmail', () => {
    it('returns null for null', () => {
      strictEqual(normalizeEmail(null), null);
    });

    it('returns null for undefined', () => {
      strictEqual(normalizeEmail(undefined), null);
    });

    it('returns null for empty string', () => {
      strictEqual(normalizeEmail(''), null);
    });

    it('returns null for whitespace-only string', () => {
      strictEqual(normalizeEmail('   '), null);
    });

    it('returns lowercase trimmed email', () => {
      strictEqual(normalizeEmail('  Foo@Bar.COM  '), 'foo@bar.com');
    });

    it('returns same when already normalized', () => {
      strictEqual(normalizeEmail('user@example.com'), 'user@example.com');
    });
  });
});
