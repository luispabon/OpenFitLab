import { describe, it, expect } from 'vitest';
import { getEnvNumber } from '../env';

describe('getEnvNumber', () => {
  it('returns default when key is missing', () => {
    expect(getEnvNumber('VITE_MISSING', { default: 5 }, {})).toBe(5);
  });

  it('returns default when key is empty string', () => {
    expect(getEnvNumber('VITE_X', { default: 5 }, { VITE_X: '' })).toBe(5);
  });

  it('parses valid number', () => {
    expect(getEnvNumber('VITE_X', { default: 5 }, { VITE_X: '7' })).toBe(7);
  });

  it('clamps to min when below', () => {
    expect(getEnvNumber('VITE_X', { default: 5, min: 1, max: 10 }, { VITE_X: '0' })).toBe(1);
  });

  it('clamps to max when above', () => {
    expect(getEnvNumber('VITE_X', { default: 5, min: 1, max: 10 }, { VITE_X: '20' })).toBe(10);
  });

  it('returns default when value is NaN', () => {
    expect(getEnvNumber('VITE_X', { default: 5 }, { VITE_X: 'not a number' })).toBe(5);
  });

  it('allows value within min/max', () => {
    expect(getEnvNumber('VITE_X', { default: 5, min: 1, max: 10 }, { VITE_X: '5' })).toBe(5);
  });
});
