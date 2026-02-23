import { describe, it, expect } from 'vitest';
import { getActivityDeviceName } from '../activity-device';

describe('getActivityDeviceName', () => {
  it('returns device name when present', () => {
    expect(getActivityDeviceName({ deviceName: 'Garmin Forerunner 945' })).toBe(
      'Garmin Forerunner 945'
    );
  });
  it('returns em dash when missing', () => {
    expect(getActivityDeviceName({})).toBe('—');
  });
  it('returns em dash when empty string', () => {
    expect(getActivityDeviceName({ deviceName: '' })).toBe('—');
  });
});
