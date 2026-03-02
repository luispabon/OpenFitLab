const { describe, it } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');
const { normalizeTcxLapStartTimes } = require('../../../src/parsers/tcx-normalizer');
const { ParseError } = require('../../../src/errors');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');

describe('tcx-normalizer normalizeTcxLapStartTimes', () => {
  it('fills missing Lap StartTime from Activity Id', () => {
    const xml = fs.readFileSync(path.join(FIXTURES_DIR, 'lap-missing-start-time.tcx'), 'utf8');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');

    normalizeTcxLapStartTimes(doc);

    const laps = doc.getElementsByTagName('Lap');
    ok(laps.length >= 1);
    const firstLap = laps[0];
    const startTime = firstLap.getAttribute('StartTime');
    ok(startTime, 'StartTime should be set');
  });

  it('throws ParseError when Lap StartTime and Activity Id are both missing', () => {
    const badXml = `<?xml version="1.0"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Running">
      <Lap>
        <TotalTimeSeconds>60</TotalTimeSeconds>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
    const doc = new DOMParser().parseFromString(badXml, 'text/xml');

    let caught = null;
    try {
      normalizeTcxLapStartTimes(doc);
    } catch (err) {
      caught = err;
    }

    ok(caught instanceof ParseError);
    ok(String(caught.message).includes('Lap missing StartTime'));
  });
});

