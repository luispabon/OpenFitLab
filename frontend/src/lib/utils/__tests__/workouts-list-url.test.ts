import { describe, it, expect } from 'vitest';
import { buildWorkoutsListPushPath } from '../workouts-list-url';

describe('buildWorkoutsListPushPath', () => {
  it('includes page and omits folder when folder is all', () => {
    expect(buildWorkoutsListPushPath(2, 20, 'all')).toBe('/?page=2');
  });

  it('appends folder when not all', () => {
    expect(buildWorkoutsListPushPath(1, 20, 'unfiled')).toBe('/?page=1&folder=unfiled');
    expect(buildWorkoutsListPushPath(3, 30, 'uuid-here')).toBe(
      '/?page=3&pageSize=30&folder=uuid-here'
    );
  });

  it('encodes folder id', () => {
    expect(buildWorkoutsListPushPath(1, 20, 'a/b')).toBe('/?page=1&folder=a%2Fb');
  });

  it('clamps page to at least 1', () => {
    expect(buildWorkoutsListPushPath(0, 20, 'all')).toBe('/?page=1');
  });
});
