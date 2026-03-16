import { describe, it, expect } from 'vitest';
import { parseHashParam } from '../hash-query';

describe('parseHashParam', () => {
  it('returns value when key is present with ?key= form', () => {
    expect(parseHashParam('/route?foo=bar', 'foo')).toBe('bar');
  });

  it('returns value when key is present with &key= form', () => {
    expect(parseHashParam('/route?a=1&foo=bar', 'foo')).toBe('bar');
  });

  it('returns null when key is absent', () => {
    expect(parseHashParam('/route?other=value', 'foo')).toBeNull();
  });

  it('returns null when key has empty value (?key=)', () => {
    expect(parseHashParam('/route?foo=', 'foo')).toBeNull();
  });

  it('returns null when key has empty value (&key=)', () => {
    expect(parseHashParam('/route?a=1&foo=', 'foo')).toBeNull();
  });

  it('returns null for empty hash string', () => {
    expect(parseHashParam('', 'foo')).toBeNull();
  });

  it('decodes encoded characters in value', () => {
    expect(parseHashParam('/route?back=%2Fcompare%2F123', 'back')).toBe('/compare/123');
  });

  it('trims whitespace from decoded value', () => {
    expect(parseHashParam('/route?foo=%20%20bar%20%20', 'foo')).toBe('bar');
  });

  it('returns null when decoded value is all whitespace', () => {
    expect(parseHashParam('/route?foo=%20%20', 'foo')).toBeNull();
  });
});
