<script lang="ts">
  import { Chart } from 'chart.js';
  import type { StreamData } from '../types';
  import type { StreamConfig } from '../utils/stream-config';
  import { getStreamConfig } from '../utils/stream-config';
  import {
    formatElapsedTime,
    formatYValue,
    toXYPoints,
    areaGradient,
    ZOOM_DRAG_OPTIONS,
    CHART_TEXT_COLOR,
    CHART_GRID_COLOR,
    type AlignedSeriesData,
  } from '../utils/chart-utils';

  interface Props {
    streamData: StreamData;
    activityStartDate: number;
    config?: StreamConfig;
  }

  let { streamData, activityStartDate, config }: Props = $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let chartInstance: Chart | null = $state(null);
  let isZoomed = $state(false);
  // Ref to avoid effect re-running when we assign chartInstance (effect must not read reactive chartInstance)
  const chartRef = { current: null as Chart | null };

  const streamConfig = $derived(config ?? getStreamConfig(streamData.type));

  // Build [x[], y[]] and full x range for reset zoom
  const chartData = $derived.by(() => {
    if (!streamData.data?.length)
      return { data: null as AlignedSeriesData | null, xMin: 0, xMax: 0, pointCount: 0 };
    const xs: number[] = [];
    const ys: (number | null)[] = [];
    for (const p of streamData.data) {
      const v = p.value;
      if (typeof v !== 'number' || isNaN(v)) continue;
      const elapsed = Math.max(0, p.time - activityStartDate);
      xs.push(elapsed);
      ys.push(v);
    }
    if (xs.length === 0) return { data: null, xMin: 0, xMax: 0, pointCount: 0 };
    const xMin = xs[0];
    const xMax = xs[xs.length - 1];
    return { data: [xs, ys] as AlignedSeriesData, xMin, xMax, pointCount: xs.length };
  });

  export function resetZoom() {
    if (!chartInstance || !chartData.data) return;
    chartInstance.resetZoom();
    isZoomed = false;
  }

  $effect(() => {
    if (!canvasEl || !chartData.data || chartData.pointCount === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const { xMin, xMax } = chartData;
    const data = chartData.data;
    const chart = new Chart(canvasEl, {
      type: 'line',
      data: {
        datasets: [
          {
            label: streamConfig.label,
            data: toXYPoints(data, 1),
            borderColor: streamConfig.color,
            borderWidth: 2,
            backgroundColor: areaGradient(streamConfig.color, '40'),
            fill: 'start',
            tension: 0.4,
            spanGaps: false,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: streamConfig.color,
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: {
            type: 'linear',
            min: xMin,
            max: xMax,
            ticks: {
              color: CHART_TEXT_COLOR,
              callback: (value) => formatElapsedTime(Number(value)),
            },
            grid: { color: CHART_GRID_COLOR },
            border: { color: CHART_TEXT_COLOR },
            title: { display: true, text: 'Elapsed Time', color: CHART_TEXT_COLOR },
          },
          y: {
            ticks: {
              color: CHART_TEXT_COLOR,
              callback: (value) => formatYValue(Number(value), streamConfig.label),
            },
            grid: { color: CHART_GRID_COLOR },
            border: { color: CHART_TEXT_COLOR },
            title: {
              display: true,
              text: streamConfig.label + (streamConfig.unit ? ` (${streamConfig.unit})` : ''),
              color: CHART_TEXT_COLOR,
            },
          },
        },
        plugins: {
          legend: { labels: { color: CHART_TEXT_COLOR } },
          tooltip: {
            callbacks: {
              title: (items) => formatElapsedTime(Number(items[0].parsed.x)),
              label: (item) =>
                `${item.dataset.label}: ${formatYValue(Number(item.parsed.y), streamConfig.label)}${streamConfig.unit ? ' ' + streamConfig.unit : ''}`,
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
  {#if !streamData.data || streamData.data.length === 0}
    <div class="flex h-96 items-center justify-center rounded-lg border border-border bg-card">
      <p class="text-sm text-text-secondary">No data available for {streamConfig.label}</p>
    </div>
  {:else if chartData.pointCount === 0}
    <div class="flex h-96 items-center justify-center rounded-lg border border-border bg-card">
      <p class="text-sm text-text-secondary">
        No valid numeric data for {streamConfig.label}
      </p>
    </div>
  {:else}
    <div class="relative pb-6">
      <button
        type="button"
        class="absolute right-2 top-2 z-10 rounded border border-border bg-card px-2 py-1 text-xs text-text-primary opacity-75 transition-opacity hover:opacity-100"
        onclick={resetZoom}
        style="display: {isZoomed ? 'block' : 'none'};"
      >
        Reset Zoom
      </button>
      <div class="h-96 w-full">
        <canvas bind:this={canvasEl}></canvas>
      </div>
    </div>
  {/if}
</div>
