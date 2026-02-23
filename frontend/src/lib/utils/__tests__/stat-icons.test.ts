import { describe, it, expect } from 'vitest';
import { getStatIcon, getStatIconMaterialName, getStatUnit, getStatLabel } from '../stat-icons';

describe('getStatIcon', () => {
  it('returns access_time for Duration', () => {
    expect(getStatIcon('Duration')).toEqual({
      type: 'material',
      name: 'access_time',
    });
  });
  it('returns access_time for Time', () => {
    expect(getStatIcon('Time')).toEqual({ type: 'material', name: 'access_time' });
  });
  it('returns moving-time svg for Moving Time', () => {
    expect(getStatIcon('Moving Time')).toEqual({
      type: 'svg',
      name: 'moving-time',
    });
  });
  it('returns trending_flat for Distance', () => {
    expect(getStatIcon('Distance')).toEqual({
      type: 'material',
      name: 'trending_flat',
    });
  });
  it('returns heart_pulse for Average Heart Rate', () => {
    expect(getStatIcon('Average Heart Rate')).toEqual({
      type: 'svg',
      name: 'heart_pulse',
    });
  });
  it('returns energy for Energy', () => {
    expect(getStatIcon('Energy')).toEqual({ type: 'svg', name: 'energy' });
  });
  it('returns energy for Calories', () => {
    expect(getStatIcon('Calories')).toEqual({ type: 'svg', name: 'energy' });
  });
  it('returns speed for Average Speed in Knots', () => {
    expect(getStatIcon('Average Speed in Knots')).toEqual({
      type: 'material',
      name: 'speed',
    });
  });
  it('returns cached for Cadence', () => {
    expect(getStatIcon('Cadence')).toEqual({
      type: 'material',
      name: 'cached',
    });
  });
  it('returns bolt for Maximum Power', () => {
    expect(getStatIcon('Maximum Power')).toEqual({
      type: 'material',
      name: 'bolt',
    });
  });
  it('returns arrow_up_right for Ascent', () => {
    expect(getStatIcon('Ascent')).toEqual({
      type: 'svg',
      name: 'arrow_up_right',
    });
  });
  it('returns arrow_down_right for Descent', () => {
    expect(getStatIcon('Descent')).toEqual({
      type: 'svg',
      name: 'arrow_down_right',
    });
  });
  it('returns vertical_align_top for Altitude Max', () => {
    expect(getStatIcon('Altitude Max')).toEqual({
      type: 'material',
      name: 'vertical_align_top',
    });
  });
  it('returns vertical_align_bottom for Altitude Min', () => {
    expect(getStatIcon('Altitude Min')).toEqual({
      type: 'material',
      name: 'vertical_align_bottom',
    });
  });
  it('returns null for unknown metric', () => {
    expect(getStatIcon('Banana')).toBeNull();
  });
});

describe('getStatIconMaterialName', () => {
  it('passthrough for material icon', () => {
    expect(getStatIconMaterialName({ type: 'material', name: 'access_time' })).toBe('access_time');
  });
  it('maps moving-time to schedule', () => {
    expect(getStatIconMaterialName({ type: 'svg', name: 'moving-time' })).toBe('schedule');
  });
  it('maps heart_pulse to favorite', () => {
    expect(getStatIconMaterialName({ type: 'svg', name: 'heart_pulse' })).toBe('favorite');
  });
  it('maps energy to local_fire_department', () => {
    expect(getStatIconMaterialName({ type: 'svg', name: 'energy' })).toBe('local_fire_department');
  });
  it('returns info for unknown svg name', () => {
    expect(getStatIconMaterialName({ type: 'svg', name: 'unknown' })).toBe('info');
  });
});

describe('getStatUnit', () => {
  it('returns empty for Duration', () => {
    expect(getStatUnit('Duration')).toBe('');
  });
  it('returns empty for Distance', () => {
    expect(getStatUnit('Distance')).toBe('');
  });
  it('returns bpm for Average Heart Rate', () => {
    expect(getStatUnit('Average Heart Rate')).toBe('bpm');
  });
  it('returns kcal for Energy', () => {
    expect(getStatUnit('Energy')).toBe('kcal');
  });
  it('returns km/h for Average Speed', () => {
    expect(getStatUnit('Average Speed')).toBe('km/h');
  });
  it('returns rpm for Cadence', () => {
    expect(getStatUnit('Cadence')).toBe('rpm');
  });
  it('returns W for Power', () => {
    expect(getStatUnit('Power')).toBe('W');
  });
  it('returns m for Ascent', () => {
    expect(getStatUnit('Ascent')).toBe('m');
  });
  it('returns m for Altitude Max', () => {
    expect(getStatUnit('Altitude Max')).toBe('m');
  });
  it('returns empty for unknown', () => {
    expect(getStatUnit('Banana')).toBe('');
  });
});

describe('getStatLabel', () => {
  it('returns metric for simple stat', () => {
    expect(getStatLabel('Duration')).toBe('Duration');
  });
  it('returns aggregation + metric', () => {
    expect(getStatLabel('Average Speed')).toBe('Average Speed');
  });
  it('strips unit variant', () => {
    expect(getStatLabel('Average Speed in Feet per Minute')).toBe('Average Speed');
  });
  it('title-cases words', () => {
    expect(getStatLabel('maximum heart rate')).toBe('Maximum Heart Rate');
  });
});
