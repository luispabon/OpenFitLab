<script lang="ts">
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import {
    formatDurationCompact,
    getPowerCurveSplits,
    CHART_HEIGHT,
    CHART_TEXT_COLOR,
    CHART_GRID_COLOR,
    CHART_POWER_COLOR,
    getSmoothPath,
  } from '../../utils/chart-utils';

  export interface CurveSeries {
    activityId: string;
    activityName: string;
    color?: string;
    data: Array<{ duration: number; power: number }>;
  }

  interface Props {
    series: CurveSeries[];
    showToggleButtons?: boolean;
    selectedActivityIds?: Set<string>;
    onToggleActivity?: (activityId: string) => void;
    maxDuration?: number; // Maximum duration in seconds to display on x-axis
  }

  let {
    series,
    showToggleButtons = false,
    selectedActivityIds,
    onToggleActivity,
    maxDuration,
  }: Props = $props();

  let containerEl: HTMLDivElement | null = $state(null);
  let chartInstance: uPlot | null = $state(null);
  let isZoomed = $state(false);
  const chartRef = { current: null as uPlot | null };

  const smoothPath = getSmoothPath();

  /** Series to display: filter by selectedActivityIds when in comparison mode. */
  const visibleSeries = $derived.by(() => {
    if (!series.length) return [];
    if (showToggleButtons && selectedActivityIds && selectedActivityIds.size > 0) {
      return series.filter((s) => selectedActivityIds!.has(s.activityId));
    }
    return series;
  });

  /** Union of all duration values across visible series, sorted, filtered to maxDuration. */
  const sharedX = $derived.by(() => {
    const xSet = new Set<number>();
    const limit = maxDuration;
    for (const s of visibleSeries) {
      for (const p of s.data) {
        if (Number.isFinite(p.duration) && p.duration > 0) {
          if (!limit || p.duration <= limit) xSet.add(p.duration);
        }
      }
    }
    return Array.from(xSet).sort((a, b) => a - b);
  });

  /** For a series, get power at a given duration (use nearest point with duration <= x, or first point). */
  function powerAtDuration(
    data: Array<{ duration: number; power: number }>,
    x: number
  ): number | null {
    if (!data.length) return null;
    let best: { duration: number; power: number } | null = null;
    for (const p of data) {
      if (p.duration <= x && Number.isFinite(p.power)) {
        if (!best || p.duration >= best.duration) best = p;
      }
    }
    if (best) return best.power;
    if (data[0].duration >= x && Number.isFinite(data[0].power)) return data[0].power;
    return null;
  }

  const chartData = $derived.by(() => {
    if (visibleSeries.length === 0 || sharedX.length === 0)
      return { data: null as uPlot.AlignedData | null, xMin: 0, xMax: 0 };

    const xMin = sharedX[0];
    // Use maxDuration if provided (activity duration), otherwise use max from data
    const xMax = maxDuration ?? sharedX[sharedX.length - 1];
    const yArrays: (number | null)[][] = [];

    for (const s of visibleSeries) {
      yArrays.push(sharedX.map((x) => powerAtDuration(s.data, x)));
    }

    const data: uPlot.AlignedData = [sharedX, ...yArrays];
    return { data, xMin, xMax };
  });

  function resetZoom() {
    if (!chartInstance || !chartData.data) return;
    const { xMin, xMax } = chartData;
    chartInstance.batch(() => {
      chartInstance!.setScale('x', { min: xMin, max: xMax });
    });
    isZoomed = false;
  }

  $effect(() => {
    if (!containerEl || !chartData.data || visibleSeries.length === 0) return;

    const textColor = CHART_TEXT_COLOR;
    const gridColor = CHART_GRID_COLOR;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const { data, xMin, xMax } = chartData;
    const nSeries = visibleSeries.length;

    const uPlotSeries: uPlot.Series[] = [{}];
    for (let i = 0; i < nSeries; i++) {
      const s = visibleSeries[i];
      const color = s.color || CHART_POWER_COLOR;
      uPlotSeries.push({
        label: s.activityName,
        stroke: color,
        width: 2,
        paths: smoothPath,
        fill: (u, seriesIdx) => {
          const ser = u.series[seriesIdx];
          const scaleKey = (ser.scale as string) || 'y';
          const sc = u.scales[scaleKey];
          if (!sc || sc.min == null || sc.max == null) return color + '40';
          const top = u.valToPos(sc.max, scaleKey, true);
          const bottom = u.valToPos(sc.min, scaleKey, true);
          const ctx = u.ctx;
          if (!ctx) return color + '40';
          const grd = ctx.createLinearGradient(0, top, 0, bottom);
          grd.addColorStop(0, color + '40');
          grd.addColorStop(1, color + '00');
          return grd;
        },
        value: (_u, raw) => (raw == null ? '' : `${Math.round(raw)} W`),
      });
    }

    const opts: uPlot.Options = {
      width: containerEl.offsetWidth,
      height: CHART_HEIGHT,
      series: uPlotSeries,
      scales: {
        x: {
          time: false,
          distr: 3,
          log: 10,
          range: () => [xMin, xMax],
        },
        y: { auto: true },
      },
      axes: [
        {
          stroke: textColor,
          grid: {
            stroke: gridColor,
            width: 1,
            filter: (_u, splits) => splits,
          },
          ticks: {
            stroke: textColor,
            filter: (_u, splits) => splits,
          },
          filter: (_u, splits) => splits,
          splits: (_u, _axisIdx, scaleMin, scaleMax) => getPowerCurveSplits(scaleMin, scaleMax),
          values: (_u, ticks) =>
            ticks.map((t) => (typeof t === 'number' ? formatDurationCompact(t) : '')),
          label: 'Duration',
          labelFont: '13px system-ui',
          font: '13px system-ui',
          size: 40,
          gap: 8,
          space: 1,
        },
        {
          stroke: textColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: textColor },
          values: (_u, ticks) =>
            ticks.map((t) => (typeof t === 'number' ? `${Math.round(t)}` : '')),
          label: 'Power (W)',
          labelFont: '13px system-ui',
          font: '13px system-ui',
          size: 36,
          gap: 5,
          space: 80,
          labelGap: 12,
          labelSize: 42,
        },
      ],
      cursor: {
        show: true,
        x: true,
        y: true,
        drag: { setScale: true, x: true, y: false },
        points: { show: true, size: 10, width: 2, stroke: '#ffffff', fill: CHART_POWER_COLOR },
      },
      legend: { show: true, live: true },
      hooks: {
        setSelect: [
          (u) => {
            setTimeout(() => {
              const xScale = u.scales.x;
              if (!xScale || xScale.min == null || xScale.max == null) return;
              const tol = (chartData.xMax - chartData.xMin) * 0.01;
              isZoomed =
                Math.abs(xScale.min - chartData.xMin) > tol ||
                Math.abs(xScale.max - chartData.xMax) > tol;
            }, 0);
          },
        ],
      },
    };

    const u = new uPlot(opts, data, containerEl);
    chartRef.current = u;
    chartInstance = u;

    const ro = new ResizeObserver(() => {
      if (chartRef.current && containerEl) {
        chartRef.current.setSize({ width: containerEl.offsetWidth, height: CHART_HEIGHT });
      }
    });
    ro.observe(containerEl);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      chartInstance = null;
    };
  });
</script>

<div class="w-full animate-fade-in">
  {#if series.length === 0}
    <div class="flex h-96 items-center justify-center rounded-lg border border-border bg-card">
      <p class="text-sm text-text-secondary">No power curve data</p>
    </div>
  {:else if visibleSeries.length === 0}
    <div class="flex h-96 items-center justify-center rounded-lg border border-border bg-card">
      <p class="text-sm text-text-secondary">Select activities above to view power curves</p>
    </div>
  {:else if !chartData.data}
    <div class="flex h-96 items-center justify-center rounded-lg border border-border bg-card">
      <p class="text-sm text-text-secondary">No valid power curve points</p>
    </div>
  {:else}
    <div class="relative pb-6">
      {#if showToggleButtons && series.length > 0 && onToggleActivity}
        <div class="mb-3 flex flex-wrap gap-2">
          {#each series as s (s.activityId)}
            {@const isSelected = !selectedActivityIds || selectedActivityIds.has(s.activityId)}
            <button
              type="button"
              class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors {isSelected
                ? 'text-text-primary'
                : 'border-border bg-transparent text-text-muted hover:bg-card-hover'}"
              style={isSelected ? `background-color: ${s.color}26; border-color: ${s.color}66` : ''}
              onclick={() => onToggleActivity(s.activityId)}
            >
              <span
                class="h-2 w-2 rounded-full {isSelected ? '' : 'opacity-40'}"
                style="background-color: {s.color};"
              ></span>
              <span>{s.activityName}</span>
            </button>
          {/each}
        </div>
      {/if}
      <button
        type="button"
        class="absolute right-2 top-2 z-10 rounded border border-border bg-card px-2 py-1 text-xs text-text-primary opacity-75 transition-opacity hover:opacity-100"
        onclick={resetZoom}
        style="display: {isZoomed ? 'block' : 'none'};"
      >
        Reset Zoom
      </button>
      <div class="h-96 w-full" bind:this={containerEl}></div>
    </div>
  {/if}
</div>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fade-in {
    animation: fade-in 0.3s ease-out;
  }
  :global(.uplot .u-legend) {
    color: var(--color-text-secondary);
    margin-bottom: 0.75rem;
  }
  :global(.uplot .u-legend tbody tr:first-child) {
    display: none;
  }
</style>
