const { describe, it } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const { buildGpx, hasGpsStreams } = require('../../../src/utils/gpx-builder');

const baseEvent = { id: 'evt-1', start_date: 1700000000000, name: 'My Ride' };
const baseActivity = { id: 'act-1', event_id: 'evt-1' };

const gpsStreams = {
  Latitude: [{ time: 1700000000000, value: 51.5 }],
  Longitude: [{ time: 1700000000000, value: -0.1 }],
};

describe('hasGpsStreams', () => {
  it('returns true with Latitude and Longitude', () => {
    ok(hasGpsStreams({ Latitude: [], Longitude: [] }));
  });

  it('returns false without GPS streams', () => {
    strictEqual(hasGpsStreams({ 'Heart Rate': [] }), false);
    strictEqual(hasGpsStreams({}), false);
  });

  it('returns false for null', () => {
    strictEqual(hasGpsStreams(null), false);
  });

  it('returns true with Position stream', () => {
    ok(hasGpsStreams({ Position: [] }));
  });

  it('returns false with only Latitude (no Longitude)', () => {
    strictEqual(hasGpsStreams({ Latitude: [] }), false);
  });
});

describe('buildGpx', () => {
  it('output starts with <?xml', () => {
    const xml = buildGpx(baseEvent, [baseActivity], { 'act-1': gpsStreams });
    ok(xml.startsWith('<?xml'));
  });

  it('contains <gpx', () => {
    const xml = buildGpx(baseEvent, [baseActivity], { 'act-1': gpsStreams });
    ok(xml.includes('<gpx'));
  });

  it('returns null when no activity has GPS data', () => {
    strictEqual(
      buildGpx(baseEvent, [baseActivity], { 'act-1': { 'Heart Rate': [] } }),
      null
    );
  });

  it('returns null when activities array is empty', () => {
    strictEqual(buildGpx(baseEvent, [], {}), null);
  });

  it('single activity with GPS produces one trkseg with trackpoints', () => {
    const xml = buildGpx(baseEvent, [baseActivity], { 'act-1': gpsStreams });
    const trksegs = (xml.match(/<trkseg>/g) || []).length;
    strictEqual(trksegs, 1);
    ok(xml.includes('<trkpt'));
  });

  it('trackpoints only emitted where both lat and lon are resolved', () => {
    // Second lat point at t+60s — lon only has one point at t=0, so at t+60s lon is >30s away
    const streams = {
      Latitude: [
        { time: 1700000000000, value: 51.5 },
        { time: 1700000060000, value: 51.6 },
      ],
      Longitude: [{ time: 1700000000000, value: -0.1 }],
    };
    const xml = buildGpx(baseEvent, [baseActivity], { 'act-1': streams });
    // Only the first trackpoint should appear (lon resolves for t=0, not for t+60s)
    const trkpts = (xml.match(/<trkpt /g) || []).length;
    strictEqual(trkpts, 1);
  });

  it('extension block omitted when no extension fields present', () => {
    const xml = buildGpx(baseEvent, [baseActivity], { 'act-1': gpsStreams });
    ok(!xml.includes('<extensions>'));
  });

  it('extension block includes only present fields', () => {
    const streams = {
      ...gpsStreams,
      'Heart Rate': [{ time: 1700000000000, value: 140 }],
      Power: [{ time: 1700000000000, value: 250 }],
    };
    const xml = buildGpx(baseEvent, [baseActivity], { 'act-1': streams });
    ok(xml.includes('<gpxtpx:hr>140</gpxtpx:hr>'));
    ok(xml.includes('<gpxtpx:power>250</gpxtpx:power>'));
    ok(!xml.includes('<gpxtpx:cad>'));
    ok(!xml.includes('<gpxtpx:atemp>'));
  });

  it('Position stream [lat, lon] array is parsed correctly', () => {
    const streams = {
      Position: [{ time: 1700000000000, value: [51.5, -0.1] }],
    };
    const xml = buildGpx(baseEvent, [baseActivity], { 'act-1': streams });
    ok(xml != null);
    ok(xml.includes('lat="51.5"'));
    ok(xml.includes('lon="-0.1"'));
  });

  it('multi-activity: activities without GPS skipped, those with GPS get a segment each', () => {
    const act2 = { id: 'act-2' };
    const act3 = { id: 'act-3' };
    const streamsByActivity = {
      'act-1': gpsStreams,
      'act-2': { 'Heart Rate': [{ time: 1700000001000, value: 130 }] },
      'act-3': {
        Latitude: [{ time: 1700000001000, value: 51.6 }],
        Longitude: [{ time: 1700000001000, value: -0.2 }],
      },
    };
    const xml = buildGpx(baseEvent, [baseActivity, act2, act3], streamsByActivity);
    const trksegs = (xml.match(/<trkseg>/g) || []).length;
    strictEqual(trksegs, 2);
  });
});
