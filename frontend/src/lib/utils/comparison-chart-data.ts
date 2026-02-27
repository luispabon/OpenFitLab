import type uPlot from 'uplot';
import type { StreamData } from '../types';

export interface ComparisonChartEntry {
  eventName: string;
  color: string;
  data: StreamData;
  activityStartDate: number;
}

export function buildComparisonChartData(
  entries: ComparisonChartEntry[],
  xAxisMode: 'elapsed' | 'wall-clock'
): { data: uPlot.AlignedData | null; xMin: number; xMax: number } {
  const withPoints: { entry: ComparisonChartEntry; pts: { x: number; y: number }[] }[] = [];

  for (const entry of entries) {
    if (!entry.data?.data?.length) continue;
    const pts: { x: number; y: number }[] = [];
    for (const p of entry.data.data) {
      const v = p.value;
      if (typeof v !== 'number' || isNaN(v)) continue;

      // X-axis: elapsed (relative) or wall-clock (absolute)
      const x = xAxisMode === 'elapsed' ? Math.max(0, p.time - entry.activityStartDate) : p.time;

      pts.push({ x, y: v });
    }
    if (pts.length > 0) withPoints.push({ entry, pts });
  }

  if (withPoints.length === 0) {
    return { data: null, xMin: 0, xMax: 0 };
  }

  // Elapsed mode: use common time origin so all series align by real time
  if (xAxisMode === 'elapsed') {
    const t0 = Math.min(...withPoints.map((w) => w.entry.activityStartDate));
    for (const w of withPoints) {
      const newPts: { x: number; y: number }[] = [];
      for (const p of w.entry.data.data) {
        const v = p.value;
        if (typeof v !== 'number' || isNaN(v)) continue;
        newPts.push({ x: Math.max(0, p.time - t0), y: v });
      }
      w.pts = newPts;
    }
  }

  // Merge all X values into sorted union
  const xSet = new Set<number>();
  for (const { pts } of withPoints) {
    for (const p of pts) xSet.add(p.x);
  }
  const xSorted = Array.from(xSet).sort((a, b) => a - b);
  if (xSorted.length === 0) return { data: null, xMin: 0, xMax: 0 };

  // Create Y arrays: one per event, aligned to union X array
  // Always use linear interpolation to fill gaps for smooth visualization
  const yArrays: (number | null)[][] = [];

  for (const { pts } of withPoints) {
    if (pts.length === 0) {
      yArrays.push(xSorted.map(() => null));
      continue;
    }

    const byX = new Map(pts.map((p) => [p.x, p.y]));
    const sortedPts = [...pts].sort((a, b) => a.x - b.x);

    // Always interpolate to fill gaps - this ensures smooth curves even with sparse data
    const interpolated: (number | null)[] = [];
    for (const x of xSorted) {
      const exact = byX.get(x);
      if (exact !== undefined) {
        interpolated.push(exact);
      } else {
        // Find surrounding points for interpolation
        let leftIdx = -1;
        let rightIdx = sortedPts.length;

        for (let i = 0; i < sortedPts.length; i++) {
          if (sortedPts[i].x < x) {
            leftIdx = i;
          } else if (sortedPts[i].x > x && rightIdx === sortedPts.length) {
            rightIdx = i;
            break;
          }
        }

        if (leftIdx >= 0 && rightIdx < sortedPts.length) {
          // Linear interpolation between surrounding points
          const left = sortedPts[leftIdx];
          const right = sortedPts[rightIdx];
          const t = (x - left.x) / (right.x - left.x);
          const interpolatedValue = left.y + t * (right.y - left.y);
          interpolated.push(interpolatedValue);
        } else if (leftIdx >= 0) {
          // Extrapolate from last point (use last known value)
          interpolated.push(sortedPts[leftIdx].y);
        } else if (rightIdx < sortedPts.length) {
          // Extrapolate from first point (use first known value)
          interpolated.push(sortedPts[rightIdx].y);
        } else {
          interpolated.push(null);
        }
      }
    }
    yArrays.push(interpolated);
  }

  const data: uPlot.AlignedData = [xSorted, ...yArrays];
  const xMin = xSorted[0];
  const xMax = xSorted[xSorted.length - 1];
  return { data, xMin, xMax };
}
