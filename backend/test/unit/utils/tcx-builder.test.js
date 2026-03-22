const { describe, it } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const { buildTcx, toTcxSport, sanitizeFilename } = require('../../../src/utils/tcx-builder');

const baseEvent = { id: 'evt-1', start_date: 1700000000000, name: 'My Run' };
const baseActivity = {
  id: 'act-1',
  event_id: 'evt-1',
  type: 'Running',
  start_date: 1700000000000,
  device_name: null,
};

describe('toTcxSport', () => {
  it('maps Running → Running', () => strictEqual(toTcxSport('Running'), 'Running'));
  it('maps running (lowercase) → Running', () => strictEqual(toTcxSport('running'), 'Running'));
  it('maps Cycling → Biking', () => strictEqual(toTcxSport('Cycling'), 'Biking'));
  it('maps cycling (lowercase) → Biking', () => strictEqual(toTcxSport('cycling'), 'Biking'));
  it('maps Elliptical → Other', () => strictEqual(toTcxSport('Elliptical'), 'Other'));
  it('maps null → Other', () => strictEqual(toTcxSport(null), 'Other'));
  it('maps undefined → Other', () => strictEqual(toTcxSport(undefined), 'Other'));
});

describe('sanitizeFilename', () => {
  it('replaces illegal chars with underscore', () => {
    strictEqual(sanitizeFilename('run/2024:01', 'fallback'), 'run_2024_01');
  });

  it('collapses multiple underscores', () => {
    strictEqual(sanitizeFilename('run//2024', 'x'), 'run_2024');
  });

  it('truncates to 100 characters', () => {
    strictEqual(sanitizeFilename('a'.repeat(150), 'fallback').length, 100);
  });

  it('falls back when name is empty string', () => {
    strictEqual(sanitizeFilename('', 'event-1'), 'event-1');
  });

  it('falls back for null', () => {
    strictEqual(sanitizeFilename(null, 'event-2'), 'event-2');
  });

  it('strips non-ASCII characters', () => {
    const result = sanitizeFilename('café run', 'fallback');
    ok(!result.includes('é'));
  });
});

describe('buildTcx', () => {
  it('output is a string starting with <?xml', () => {
    const xml = buildTcx(baseEvent, [baseActivity], {}, { 'act-1': {} });
    ok(typeof xml === 'string');
    ok(xml.startsWith('<?xml'));
  });

  it('contains <TrainingCenterDatabase', () => {
    const xml = buildTcx(baseEvent, [baseActivity], {}, { 'act-1': {} });
    ok(xml.includes('<TrainingCenterDatabase'));
  });

  it('single activity with no streams produces valid XML with empty Track', () => {
    const xml = buildTcx(baseEvent, [baseActivity], {}, { 'act-1': {} });
    ok(xml.includes('<Track>'));
    ok(xml.includes('</Track>'));
    ok(!xml.includes('<Trackpoint>'));
  });

  it('lap stats fields present when stat keys exist', () => {
    const stats = { 'act-1': { Duration: 3600, Distance: 10000, Energy: 500 } };
    const xml = buildTcx(baseEvent, [baseActivity], stats, { 'act-1': {} });
    ok(xml.includes('<TotalTimeSeconds>3600</TotalTimeSeconds>'));
    ok(xml.includes('<DistanceMeters>10000</DistanceMeters>'));
    ok(xml.includes('<Calories>500</Calories>'));
  });

  it('lap stats fields omitted when absent', () => {
    const xml = buildTcx(baseEvent, [baseActivity], { 'act-1': {} }, { 'act-1': {} });
    ok(!xml.includes('<TotalTimeSeconds>'));
    ok(!xml.includes('<Calories>'));
    ok(!xml.includes('<MaximumSpeed>'));
  });

  it('trackpoint contains Position when Latitude+Longitude streams present', () => {
    const streams = {
      'act-1': {
        Latitude: [{ time: 1700000000000, value: 51.5 }],
        Longitude: [{ time: 1700000000000, value: -0.1 }],
      },
    };
    const xml = buildTcx(baseEvent, [baseActivity], {}, streams);
    ok(xml.includes('<Position>'));
    ok(xml.includes('<LatitudeDegrees>51.5</LatitudeDegrees>'));
    ok(xml.includes('<LongitudeDegrees>-0.1</LongitudeDegrees>'));
  });

  it('trackpoint handles Position stream as [lat, lon] array', () => {
    const streams = {
      'act-1': {
        Position: [{ time: 1700000000000, value: [51.5, -0.1] }],
      },
    };
    const xml = buildTcx(baseEvent, [baseActivity], {}, streams);
    ok(xml.includes('<Position>'));
    ok(xml.includes('<LatitudeDegrees>51.5</LatitudeDegrees>'));
  });

  it('trackpoint omits Position when no GPS streams', () => {
    const streams = {
      'act-1': { 'Heart Rate': [{ time: 1700000000000, value: 140 }] },
    };
    const xml = buildTcx(baseEvent, [baseActivity], {}, streams);
    ok(!xml.includes('<Position>'));
  });

  it('Extensions block rendered when speed present, omitted when neither speed nor power', () => {
    const withSpeed = {
      'act-1': {
        Speed: [{ time: 1700000000000, value: 3.0 }],
        'Heart Rate': [{ time: 1700000000000, value: 140 }],
      },
    };
    const withoutSpeedOrPower = {
      'act-1': { 'Heart Rate': [{ time: 1700000000000, value: 140 }] },
    };
    ok(buildTcx(baseEvent, [baseActivity], {}, withSpeed).includes('<Extensions>'));
    ok(!buildTcx(baseEvent, [baseActivity], {}, withoutSpeedOrPower).includes('<Extensions>'));
  });

  it('Extensions block not rendered when only Heart Rate is present', () => {
    const streams = {
      'act-1': { 'Heart Rate': [{ time: 1700000000000, value: 140 }] },
    };
    ok(!buildTcx(baseEvent, [baseActivity], {}, streams).includes('<Extensions>'));
  });

  it('multi-activity event produces multiple Lap elements', () => {
    const act2 = {
      id: 'act-2',
      event_id: 'evt-1',
      type: 'Cycling',
      start_date: 1700001000000,
      device_name: null,
    };
    const xml = buildTcx(baseEvent, [baseActivity, act2], {}, { 'act-1': {}, 'act-2': {} });
    const lapCount = (xml.match(/<Lap /g) || []).length;
    strictEqual(lapCount, 2);
  });

  it('Creator element rendered when device_name present', () => {
    const actWithDevice = { ...baseActivity, device_name: 'Garmin Forerunner 945' };
    const xml = buildTcx(baseEvent, [actWithDevice], {}, { 'act-1': {} });
    ok(xml.includes('<Creator xsi:type="Device_t">'));
    ok(xml.includes('<Name>Garmin Forerunner 945</Name>'));
  });

  it('Creator element omitted when device_name is null', () => {
    const xml = buildTcx(baseEvent, [baseActivity], {}, { 'act-1': {} });
    ok(!xml.includes('<Creator'));
  });

  it('uses event start_date for lap when activity start_date is null', () => {
    const actNoDate = { ...baseActivity, start_date: null };
    const xml = buildTcx(baseEvent, [actNoDate], {}, { 'act-1': {} });
    const eventIso = new Date(1700000000000).toISOString();
    ok(xml.includes(`StartTime="${eventIso}"`));
  });
});
