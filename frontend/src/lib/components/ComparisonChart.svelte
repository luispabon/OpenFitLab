<script lang="ts">
  import { Chart } from 'chart.js';
  import {
    buildComparisonChartData,
    type ComparisonChartEntry,
  } from '../utils/comparison-chart-data';
  import { getStreamConfig } from '../utils/stream-config';
  import {
    alignedYRange,
    createAlignedViewportDecimationPlugin,
  } from '../utils/viewport-decimation';
  import {
    formatElapsedTime,
    formatWallClockTime,
    formatYValue,
    toXYPoints,
    areaGradient,
    ZOOM_DRAG_OPTIONS,
    ZOOM_TRANSITION_OPTIONS,
    CHART_TEXT_COLOR,
    CHART_GRID_COLOR,
  } from '../utils/chart-utils';

  interface Props {
    streamType: string;
    entries: ComparisonChartEntry[];
    xAxisMode: 'elapsed' | 'wall-clock';
  }

  let { streamType, entries, xAxisMode }: Props = $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let chartInstance: Chart | null = $state(null);
  let isZoomed = $state(false);
  const chartRef = { current: null as Chart | null };

  const streamConfig = $derived(getStreamConfig(streamType));

  const chartData = $derived.by(() => buildComparisonChartData(entries, xAxisMode));

  function formatXValue(value: number): string {
    return xAxisMode === 'elapsed' ? formatElapsedTime(value) : formatWallClockTime(value);
  }

  function resetZoom() {
    if (!chartInstance || !chartData.data) return;
    chartInstance.resetZoom('none');
    isZoomed = false;
  }

  $effect(() => {
    if (!canvasEl || !chartData.data || entries.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const { xMin, xMax } = chartData;
    const data = chartData.data;

    // Suggested y bounds from the full data of every series, so a zoomed slice cannot narrow the
    // axis below the global extremes.
    const yRange = alignedYRange(
      data,
      entries.map((_, i) => i + 1)
    );
    const yBounds = yRange ? { suggestedMin: yRange.min, suggestedMax: yRange.max } : {};

    // Series: one per event, all share same Y-axis
    const datasets = entries.map((entry, i) => ({
      label: entry.eventName,
      data: toXYPoints(data, i + 1),
      borderColor: entry.color,
      borderWidth: 2,
      backgroundColor: areaGradient(entry.color, '30'),
      fill: 'start' as const,
      tension: 0.4,
      spanGaps: false, // Don't span gaps - show them explicitly
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: entry.color,
      pointHoverBorderColor: '#ffffff',
      pointHoverBorderWidth: 2,
    }));

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
            type: 'linear',
            min: xMin,
            max: xMax,
            ticks: {
              color: CHART_TEXT_COLOR,
              callback: (value) => formatXValue(Number(value)),
            },
            grid: { color: CHART_GRID_COLOR },
            border: { color: CHART_TEXT_COLOR },
            title: {
              display: true,
              text: xAxisMode === 'elapsed' ? 'Elapsed Time' : 'Time',
              color: CHART_TEXT_COLOR,
            },
          },
          y: {
            ...yBounds,
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
              title: (items) => formatXValue(Number(items[0].parsed.x)),
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
      plugins: [createAlignedViewportDecimationPlugin({ fullData: data })],
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
  {#if entries.length === 0 || !chartData.data}
    <div class="flex h-96 items-center justify-center rounded-lg border border-border bg-card">
      <p class="text-sm text-text-secondary">No data available</p>
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
