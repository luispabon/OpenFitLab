<script lang="ts">
  import { Chart } from 'chart.js';
  import {
    formatDurationCompact,
    toXYPoints,
    areaGradient,
    ZOOM_DRAG_OPTIONS,
    ZOOM_TRANSITION_OPTIONS,
    CHART_TEXT_COLOR,
    CHART_GRID_COLOR,
    CHART_POWER_COLOR,
    type AlignedSeriesData,
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

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let chartInstance: Chart | null = $state(null);
  let isZoomed = $state(false);
  const chartRef = { current: null as Chart | null };

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
      return { data: null as AlignedSeriesData | null, xMin: 0, xMax: 0 };

    const xMin = sharedX[0];
    // Use maxDuration if positive (activity duration), otherwise use max from data.
    // A non-positive maxDuration is invalid on a logarithmic axis.
    const xMax = maxDuration && maxDuration > 0 ? maxDuration : sharedX[sharedX.length - 1];
    const yArrays: (number | null)[][] = [];

    for (const s of visibleSeries) {
      yArrays.push(sharedX.map((x) => powerAtDuration(s.data, x)));
    }

    const data: AlignedSeriesData = [sharedX, ...yArrays];
    return { data, xMin, xMax };
  });

  function resetZoom() {
    if (!chartInstance || !chartData.data) return;
    chartInstance.resetZoom('none');
    isZoomed = false;
  }

  $effect(() => {
    if (!canvasEl || !chartData.data || visibleSeries.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const { xMin, xMax } = chartData;
    const data = chartData.data;
    const datasets = visibleSeries.map((s, i) => {
      const color = s.color || CHART_POWER_COLOR;
      return {
        label: s.activityName,
        data: toXYPoints(data, i + 1),
        borderColor: color,
        borderWidth: 2,
        backgroundColor: areaGradient(color, '40'),
        fill: 'start' as const,
        tension: 0.4,
        spanGaps: false,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
      };
    });

    const chart = new Chart(canvasEl, {
      type: 'line',
      data: { datasets },
      options: {
        ...ZOOM_TRANSITION_OPTIONS,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            type: 'logarithmic',
            min: xMin,
            max: xMax,
            ticks: {
              color: CHART_TEXT_COLOR,
              callback: (value) => formatDurationCompact(Number(value)),
            },
            grid: { color: CHART_GRID_COLOR },
            border: { color: CHART_TEXT_COLOR },
            title: { display: true, text: 'Duration', color: CHART_TEXT_COLOR },
          },
          y: {
            ticks: {
              color: CHART_TEXT_COLOR,
              callback: (value) => `${Math.round(Number(value))}`,
            },
            grid: { color: CHART_GRID_COLOR },
            border: { color: CHART_TEXT_COLOR },
            title: { display: true, text: 'Power (W)', color: CHART_TEXT_COLOR },
          },
        },
        plugins: {
          legend: { labels: { color: CHART_TEXT_COLOR } },
          tooltip: {
            callbacks: {
              title: (items) => formatDurationCompact(Number(items[0].parsed.x)),
              label: (item) => `${item.dataset.label}: ${Math.round(Number(item.parsed.y))} W`,
            },
          },
          zoom: {
            zoom: {
              mode: 'x',
              drag: ZOOM_DRAG_OPTIONS,
              onZoomComplete: ({ chart }) => {
                isZoomed = chart.isZoomedOrPanned();
              },
            },
          },
        },
      },
    });
    chartRef.current = chart;
    chartInstance = chart;

    return () => {
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
        data-export-exclude
      >
        Reset Zoom
      </button>
      <div class="h-96 w-full">
        <canvas bind:this={canvasEl}></canvas>
      </div>
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
</style>
