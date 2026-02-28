import { describe, it, expect } from 'vitest';
import { mergeBounds, buildRouteGeoJSON, type RouteBounds } from '../geo';

describe('mergeBounds', () => {
  it('returns default small bounds for empty array', () => {
    const result = mergeBounds([]);
    expect(result.minLng).toBe(-0.0001);
    expect(result.maxLng).toBe(0.0001);
    expect(result.minLat).toBe(-0.0001);
    expect(result.maxLat).toBe(0.0001);
  });

  it('returns same bounds for single entry (with possible padding)', () => {
    const b: RouteBounds = { minLng: 1, maxLng: 2, minLat: 3, maxLat: 4 };
    const result = mergeBounds([b]);
    expect(result).toEqual(b);
  });

  it('returns envelope for two non-overlapping bounds', () => {
    const a: RouteBounds = { minLng: 0, maxLng: 1, minLat: 0, maxLat: 1 };
    const b: RouteBounds = { minLng: 2, maxLng: 3, minLat: 2, maxLat: 3 };
    const result = mergeBounds([a, b]);
    expect(result.minLng).toBe(0);
    expect(result.maxLng).toBe(3);
    expect(result.minLat).toBe(0);
    expect(result.maxLat).toBe(3);
  });

  it('applies padding when span is degenerate', () => {
    const b: RouteBounds = { minLng: 5, maxLng: 5, minLat: 5, maxLat: 5 };
    const result = mergeBounds([b]);
    expect(result.maxLng - result.minLng).toBeCloseTo(0.0002, 10);
    expect(result.maxLat - result.minLat).toBeCloseTo(0.0002, 10);
  });

  it('returns exact union for large bounds', () => {
    const a: RouteBounds = { minLng: -10, maxLng: 0, minLat: 0, maxLat: 5 };
    const b: RouteBounds = { minLng: 0, maxLng: 10, minLat: -5, maxLat: 0 };
    const result = mergeBounds([a, b]);
    expect(result.minLng).toBe(-10);
    expect(result.maxLng).toBe(10);
    expect(result.minLat).toBe(-5);
    expect(result.maxLat).toBe(5);
  });
});

describe('buildRouteGeoJSON', () => {
  it('builds route from Position stream with valid data', () => {
    const streams = [
      {
        type: 'Position',
        data: [
          { time: 0, value: { latitude: 40, longitude: -74 } },
          { time: 1, value: { latitude: 41, longitude: -73 } },
        ],
      },
    ];
    const result = buildRouteGeoJSON(streams);
    expect(result).not.toBeNull();
    expect(result!.route.geometry.type).toBe('LineString');
    expect(result!.route.geometry.coordinates).toEqual([
      [-74, 40],
      [-73, 41],
    ]);
    expect(result!.route.properties).toEqual({});
    expect(result!.bounds.minLng).toBe(-74);
    expect(result!.bounds.maxLng).toBe(-73);
    expect(result!.bounds.minLat).toBe(40);
    expect(result!.bounds.maxLat).toBe(41);
  });

  it('returns null when Position stream has only one valid point', () => {
    const streams = [
      {
        type: 'Position',
        data: [{ time: 0, value: { latitude: 40, longitude: -74 } }],
      },
    ];
    expect(buildRouteGeoJSON(streams)).toBeNull();
  });

  it('skips invalid Position values and returns null if fewer than 2 valid', () => {
    const streams = [
      {
        type: 'Position',
        data: [
          { time: 0, value: { latitude: Number.NaN, longitude: -74 } },
          { time: 1, value: { latitude: 41, longitude: -73 } },
        ],
      },
    ];
    expect(buildRouteGeoJSON(streams)).toBeNull();
  });

  it('builds from Latitude and Longitude streams with matching timestamps', () => {
    const streams = [
      {
        type: 'Latitude',
        data: [
          { time: 1000, value: 40 },
          { time: 2000, value: 41 },
        ],
      },
      {
        type: 'Longitude',
        data: [
          { time: 1000, value: -74 },
          { time: 2000, value: -73 },
        ],
      },
    ];
    const result = buildRouteGeoJSON(streams);
    expect(result).not.toBeNull();
    expect(result!.route.geometry.coordinates).toEqual([
      [-74, 40],
      [-73, 41],
    ]);
  });

  it('returns null when Lat/Lng have fewer than 2 matching timestamps', () => {
    const streams = [
      { type: 'Latitude', data: [{ time: 1000, value: 40 }] },
      { type: 'Longitude', data: [{ time: 1000, value: -74 }] },
    ];
    expect(buildRouteGeoJSON(streams)).toBeNull();
  });

  it('returns null when no location streams', () => {
    const streams = [{ type: 'Heart Rate', data: [{ time: 0, value: 120 }] }];
    expect(buildRouteGeoJSON(streams)).toBeNull();
  });

  it('returns null for empty streams array', () => {
    expect(buildRouteGeoJSON([])).toBeNull();
  });

  it('prefers Position stream when both Position and Lat/Lng exist', () => {
    const streams = [
      {
        type: 'Position',
        data: [
          { time: 0, value: { latitude: 1, longitude: 2 } },
          { time: 1, value: { latitude: 3, longitude: 4 } },
        ],
      },
      {
        type: 'Latitude',
        data: [
          { time: 1000, value: 40 },
          { time: 2000, value: 41 },
        ],
      },
      {
        type: 'Longitude',
        data: [
          { time: 1000, value: -74 },
          { time: 2000, value: -73 },
        ],
      },
    ];
    const result = buildRouteGeoJSON(streams);
    expect(result).not.toBeNull();
    expect(result!.route.geometry.coordinates).toEqual([
      [2, 1],
      [4, 3],
    ]);
  });

  it('applies MIN_BOUNDS_SPAN padding when Position points are degenerate (same or nearly same)', () => {
    const streams = [
      {
        type: 'Position',
        data: [
          { time: 0, value: { latitude: 40.0, longitude: -74.0 } },
          { time: 1, value: { latitude: 40.0, longitude: -74.0 } },
        ],
      },
    ];
    const result = buildRouteGeoJSON(streams);
    expect(result).not.toBeNull();
    const b = result!.bounds;
    expect(b.maxLng - b.minLng).toBeGreaterThanOrEqual(0.0002);
    expect(b.maxLat - b.minLat).toBeGreaterThanOrEqual(0.0002);
  });

  it('uses only timestamps present in both Lat and Lng', () => {
    const streams = [
      {
        type: 'Latitude',
        data: [
          { time: 1000, value: 40 },
          { time: 2000, value: 41 },
          { time: 3000, value: 42 },
        ],
      },
      {
        type: 'Longitude',
        data: [
          { time: 1000, value: -74 },
          { time: 3000, value: -72 },
        ],
      },
    ];
    const result = buildRouteGeoJSON(streams);
    expect(result).not.toBeNull();
    expect(result!.route.geometry.coordinates).toHaveLength(2);
    expect(result!.route.geometry.coordinates[0]).toEqual([-74, 40]);
    expect(result!.route.geometry.coordinates[1]).toEqual([-72, 42]);
  });
});
