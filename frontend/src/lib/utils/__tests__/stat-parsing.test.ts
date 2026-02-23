import { describe, it, expect } from 'vitest';
import { parseStat } from '../stat-parsing';

describe('parseStat', () => {
  it('parses simple metric with no aggregation or unit', () => {
    const result = parseStat('Duration');
    expect(result.metric).toBe('Duration');
    expect(result.aggregation).toBeNull();
    expect(result.unitVariant).toBeNull();
    expect(result.original).toBe('Duration');
  });

  it('parses metric with aggregation', () => {
    const result = parseStat('Average Speed');
    expect(result.metric).toBe('Speed');
    expect(result.aggregation).toBe('Average');
    expect(result.unitVariant).toBeNull();
  });

  it('parses metric with aggregation and unit variant', () => {
    const result = parseStat('Average Speed in Kilometers per Hour');
    expect(result.metric).toBe('Speed');
    expect(result.aggregation).toBe('Average');
    expect(result.unitVariant).toBe('Kilometers per Hour');
  });

  it('parses Maximum aggregation', () => {
    const result = parseStat('Maximum Heart Rate');
    expect(result.metric).toBe('Heart Rate');
    expect(result.aggregation).toBe('Maximum');
  });

  it('parses Minimum aggregation', () => {
    const result = parseStat('Minimum Heart Rate');
    expect(result.metric).toBe('Heart Rate');
    expect(result.aggregation).toBe('Minimum');
  });

  it('parses Max shorthand aggregation', () => {
    const result = parseStat('Max Heart Rate');
    expect(result.metric).toBe('Heart Rate');
    expect(result.aggregation).toBe('Max');
  });

  it('parses Min shorthand aggregation', () => {
    const result = parseStat('Min Heart Rate');
    expect(result.metric).toBe('Heart Rate');
    expect(result.aggregation).toBe('Min');
  });

  it('parses unit variant only (no aggregation)', () => {
    const result = parseStat('Distance in Meters');
    expect(result.metric).toBe('Distance');
    expect(result.aggregation).toBeNull();
    expect(result.unitVariant).toBe('Meters');
  });

  it('uses last " in " for unit variant when multiple present', () => {
    const result = parseStat('Average Speed in Feet in Minutes');
    expect(result.unitVariant).toBe('Minutes');
  });

  it('trims leading and trailing whitespace', () => {
    const result = parseStat('  Duration  ');
    expect(result.metric).toBe('Duration');
    expect(result.original).toBe('  Duration  ');
  });

  it('parses two-word metric Moving Time', () => {
    const result = parseStat('Moving Time');
    expect(result.metric).toBe('Moving Time');
    expect(result.aggregation).toBeNull();
    expect(result.unitVariant).toBeNull();
  });

  it('parses compound with aggregation and unit variant', () => {
    const result = parseStat('Average Moving Time in Seconds');
    expect(result.metric).toBe('Moving Time');
    expect(result.aggregation).toBe('Average');
    expect(result.unitVariant).toBe('Seconds');
  });

  it('preserves original input in return', () => {
    const input = 'Average Speed in Knots';
    const result = parseStat(input);
    expect(result.original).toBe(input);
  });

  it('does not treat "Average" alone as aggregation (length check)', () => {
    const result = parseStat('Average');
    expect(result.metric).toBe('Average');
    expect(result.aggregation).toBeNull();
  });
});
