const { describe, it } = require('node:test');
const { strictEqual, ok } = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const FileParser = require('../../../src/parsers/file-parser');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures');

describe('FileParser.getExtension', () => {
  it('returns extension for foo.tcx', () => {
    strictEqual(FileParser.getExtension('foo.tcx'), 'tcx');
  });

  it('returns lowercase extension for foo.TCX', () => {
    strictEqual(FileParser.getExtension('foo.TCX'), 'tcx');
  });

  it('returns base extension for foo.tcx.gz', () => {
    strictEqual(FileParser.getExtension('foo.tcx.gz'), 'tcx');
  });

  it('returns empty string for filename without extension', () => {
    strictEqual(FileParser.getExtension('noext'), '');
  });

  it('returns empty string for single dot', () => {
    strictEqual(FileParser.getExtension('.'), '');
  });
});

describe('FileParser.isGzipped', () => {
  it('returns true for buffer with gzip magic bytes', () => {
    const buf = Buffer.alloc(10);
    buf[0] = 0x1f;
    buf[1] = 0x8b;
    strictEqual(FileParser.isGzipped(buf), true);
  });

  it('returns false for buffer too short', () => {
    strictEqual(FileParser.isGzipped(Buffer.from([0x1f])), false);
    strictEqual(FileParser.isGzipped(Buffer.alloc(0)), false);
  });

  it('returns false for non-gzip buffer', () => {
    strictEqual(FileParser.isGzipped(Buffer.from([0x00, 0x00, 0x00])), false);
  });
});

describe('FileParser.parseFile', () => {
  it('parses minimal.tcx and returns event with activities', async () => {
    const tcxPath = path.join(FIXTURES_DIR, 'minimal.tcx');
    const buffer = fs.readFileSync(tcxPath);
    const event = await FileParser.parseFile(buffer, 'tcx', 'minimal.tcx');
    ok(event);
    ok(event.name);
    ok(event.getActivities);
    const activities = event.getActivities();
    ok(Array.isArray(activities));
    strictEqual(activities.length >= 1, true);
  });

  it('uses filename (without extension) as event name when provided', async () => {
    const tcxPath = path.join(FIXTURES_DIR, 'minimal.tcx');
    const buffer = fs.readFileSync(tcxPath);
    const event = await FileParser.parseFile(buffer, 'tcx', 'My Morning Run.tcx');
    strictEqual(event.name, 'My Morning Run');
  });

  it('parses minimal.gpx and returns event', { skip: true }, async () => {
    // Skipped: sports-lib GPX path can throw "domParser is not a constructor" in Node.
    // Fixture minimal.gpx exists; re-enable when library or env supports GPX in Node.
    const gpxPath = path.join(FIXTURES_DIR, 'minimal.gpx');
    const buffer = fs.readFileSync(gpxPath);
    const event = await FileParser.parseFile(buffer, 'gpx', 'minimal.gpx');
    ok(event);
    ok(event.getActivities);
    const activities = event.getActivities();
    ok(Array.isArray(activities));
    strictEqual(activities.length >= 1, true);
  });

  it('throws for unsupported extension', async () => {
    await require('node:assert').rejects(
      async () => FileParser.parseFile(Buffer.from('x'), 'xyz', 'file.xyz'),
      (err) => err.message.includes('Unsupported file format') && err.message.includes('xyz')
    );
  });

  it('throws with message including filename for invalid file', async () => {
    await require('node:assert').rejects(
      async () => FileParser.parseFile(Buffer.from('not valid tcx'), 'tcx', 'bad.tcx'),
      (err) => err.message.includes('bad.tcx')
    );
  });

  it('parses gzipped TCX when buffer is gzipped', async () => {
    const tcxPath = path.join(FIXTURES_DIR, 'minimal.tcx');
    const tcxBuffer = fs.readFileSync(tcxPath);
    const gzipped = zlib.gzipSync(tcxBuffer);
    const event = await FileParser.parseFile(gzipped, 'tcx', 'minimal.tcx.gz');
    ok(event);
    ok(event.getActivities());
    strictEqual(event.getActivities().length >= 1, true);
  });
});
