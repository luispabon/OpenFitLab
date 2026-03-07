import { describe, it, expect } from 'vitest';
import {
  formatDurationCell,
  formatDistanceCell,
  formatAvgHeartRateCell,
  formatCaloriesCell,
} from '../workouts-table-formatters';

describe('formatDurationCell', () => {
  it('formats Duration stat', () => {
    expect(formatDurationCell({ Duration: 3600 })).toBe('1:00:00');
  });
  it('uses Moving Time when Duration missing', () => {
    expect(formatDurationCell({ 'Moving Time': 488 })).toBe('08:08');
  });
  it('returns em dash when neither present', () => {
    expect(formatDurationCell({ Distance: 5000 })).toBe('—');
  });
});

describe('formatDistanceCell', () => {
  it('formats Distance stat', () => {
    expect(formatDistanceCell({ Distance: 1690 })).toBe('1.69km');
  });
  it('returns em dash when missing', () => {
    expect(formatDistanceCell({ Duration: 100 })).toBe('—');
  });
});

describe('formatAvgHeartRateCell', () => {
  it('formats Average Heart Rate stat', () => {
    expect(formatAvgHeartRateCell({ 'Average Heart Rate': 145 })).toBe('145');
  });
  it('returns em dash when missing', () => {
    expect(formatAvgHeartRateCell({})).toBe('—');
  });
});

describe('formatCaloriesCell', () => {
  it('formats Energy stat', () => {
    expect(formatCaloriesCell({ Energy: 500 })).toBe('500');
  });
  it('uses Calories when Energy missing', () => {
    expect(formatCaloriesCell({ Calories: 300 })).toBe('300');
  });
  it('returns em dash when neither present', () => {
    expect(formatCaloriesCell({})).toBe('—');
  });
});
