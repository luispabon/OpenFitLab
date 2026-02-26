const { ParseError } = require('../errors');

/**
 * Ensures every Lap in the TCX document has a StartTime attribute.
 * Some exporters (e.g. Mi Fitness) emit Laps without StartTime; sports-lib then
 * produces Invalid Date and later throws "Invalid array length" when creating streams.
 * We set missing StartTime from the Activity's Id (first lap) or previous lap end (later laps).
 *
 * @param {Document} xmlDoc - Parsed TCX document (mutated in place)
 * @throws {ParseError} When a Lap needs StartTime but Activity has no valid Id
 */
function normalizeTcxLapStartTimes(xmlDoc) {
  const roots = xmlDoc.getElementsByTagName('TrainingCenterDatabase');
  if (!roots.length) return;

  const root = roots[0];
  const activities = root.getElementsByTagName('Activity');

  for (let a = 0; a < activities.length; a++) {
    const activity = activities[a];
    const idEl = activity.getElementsByTagName('Id')[0];
    const idText = idEl && idEl.textContent ? idEl.textContent.trim() : '';
    const activityStart = idText && !Number.isNaN(Date.parse(idText)) ? new Date(idText) : null;

    const laps = activity.getElementsByTagName('Lap');
    let lastEndMs = null;

    for (let i = 0; i < laps.length; i++) {
      const lap = laps[i];
      let startAttr = lap.getAttribute('StartTime') || '';
      if (typeof startAttr !== 'string') startAttr = '';
      startAttr = startAttr.trim();

      if (!startAttr) {
        if (i === 0) {
          if (!activityStart || Number.isNaN(activityStart.getTime())) {
            throw new ParseError('TCX Lap missing StartTime and Activity has no valid Id');
          }
          startAttr = activityStart.toISOString();
        } else {
          if (lastEndMs == null) {
            throw new ParseError('TCX Lap missing StartTime and Activity has no valid Id');
          }
          startAttr = new Date(lastEndMs).toISOString();
        }
        lap.setAttribute('StartTime', startAttr);
      }

      const totalEl = lap.getElementsByTagName('TotalTimeSeconds')[0];
      const totalSeconds = totalEl ? Number(totalEl.textContent) || 0 : 0;
      const startMs = new Date(startAttr).getTime();
      if (!Number.isNaN(startMs)) {
        lastEndMs = startMs + totalSeconds * 1000;
      }
    }
  }
}

module.exports = { normalizeTcxLapStartTimes };
