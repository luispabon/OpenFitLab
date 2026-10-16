<script lang="ts">
  import { Chart } from 'chart.js';
  import type { StreamData } from '../types';
  import { getStreamConfig } from '../utils/stream-config';
  import {
    alignedYRange,
    createAlignedViewportDecimationPlugin,
  } from '../utils/viewport-decimation';
  import {
    formatElapsedTime,
    formatYValue,
    toXYPoints,
    areaGradient,
    ZOOM_DRAG_OPTIONS,
    ZOOM_TRANSITION_OPTIONS,
    CHART_TEXT_COLOR,
    CHART_GRID_COLOR,
    type AlignedSeriesData,
  } from '../utils/chart-utils';

  interface Props {
    streams: StreamData[];
    activityStartDate: number;
  }

  let { streams, activityStartDate }: Props = $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let chartInstance: Chart | null = $state(null);
  let isZoomed = $state(false);
  const chartRef = { current: null as Chart | null };

  // Build aligned data: one x array (sorted union of all x) and one y array per stream (value or null)
  const chartData = $derived.by(() => {
    const withPoints: { stream: StreamData; pts: { x: number; y: number }[] }[] = [];
    for (const stream of streams) {
      if (!stream.data?.length) continue;
      const pts: { x: number; y: number }[] = [];
      for (const p of stream.data) {
        const v = p.value;
        if (typeof v !== 'number' || isNaN(v)) continue;
        pts.push({ x: Math.max(0, p.time - activityStartDate), y: v });
      }
      if (pts.length > 0) withPoints.push({ stream, pts });
    }
    if (withPoints.length === 0)
      return { data: null as AlignedSeriesData | null, xMin: 0, xMax: 0, configs: [] };

    const xSet = new Set<number>();
    for (const { pts } of withPoints) {
      for (const p of pts) xSet.add(p.x);
    }
    const xSorted = Array.from(xSet).sort((a, b) => a - b);
    if (xSorted.length === 0) return { data: null, xMin: 0, xMax: 0, configs: [] };

    const configs = withPoints.map(({ stream }) => getStreamConfig(stream.type));
    const yArrays: (number | null)[][] = [];
    for (const { pts } of withPoints) {
      const byX = new Map(pts.map((p) => [p.x, p.y]));
      yArrays.push(xSorted.map((x) => byX.get(x) ?? null));
    }
    const data: AlignedSeriesData = [xSorted, ...yArrays];
    const xMin = xSorted[0];
    const xMax = xSorted[xSorted.length - 1];
    return { data, xMin, xMax, configs };
  });

  function resetZoom() {
    if (!chartInstance || !chartData.data) return;
    chartInstance.resetZoom('none');
    isZoomed = false;
  }

  function getYScaleKey(index: number, total: number): string {
    if (total <= 1) return 'y';
    return index % 2 === 0 ? 'y' : 'y1';
  }

  $effect(() => {
    if (!canvasEl || !chartData.data || chartData.configs.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const { xMin, xMax, configs } = chartData;
    const data = chartData.data;
    const nSeries = configs.length;
    const leftConfig = configs[0];
    const rightConfig = configs.length > 1 ? configs[1] : null;

    // Suggested bounds from the full data of each y axis: Chart.js keeps auto range and tick
    // rounding, and a zoomed slice cannot narrow the axis below the global extremes.
    const seriesIndices = configs.map((_, i) => i + 1);
    const leftRange = alignedYRange(
      data,
      seriesIndices.filter((_, i) => getYScaleKey(i, nSeries) === 'y')
    );
    const rightRange = alignedYRange(
      data,
      seriesIndices.filter((_, i) => getYScaleKey(i, nSeries) === 'y1')
    );
    const leftBounds = leftRange
      ? { suggestedMin: leftRange.min, suggestedMax: leftRange.max }
      : {};
    const rightBounds = rightRange
      ? { suggestedMin: rightRange.min, suggestedMax: rightRange.max }
      : {};

    const datasets = configs.map((cfg, i) => ({
      label: cfg.label,
      data: toXYPoints(data, i + 1),
      yAxisID: getYScaleKey(i, nSeries),
      borderColor: cfg.color,
      borderWidth: 2,
      backgroundColor: areaGradient(cfg.color, '30'),
      fill: 'start' as const,
      tension: 0.4,
      spanGaps: false,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: cfg.color,
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
              callback: (value) => formatElapsedTime(Number(value)),
            },
            grid: { color: CHART_GRID_COLOR },
            border: { color: CHART_TEXT_COLOR },
            title: { display: true, text: 'Elapsed Time', color: CHART_TEXT_COLOR },
          },
          y: {
            position: 'left',
            ...leftBounds,
            ticks: {
              color: CHART_TEXT_COLOR,
              callback: (value) => formatYValue(Number(value), leftConfig.label),
            },
            grid: { color: CHART_GRID_COLOR },
            border: { color: CHART_TEXT_COLOR },
            title: {
              display: true,
              text: leftConfig.label + (leftConfig.unit ? ` (${leftConfig.unit})` : ''),
              color: CHART_TEXT_COLOR,
            },
          },
          ...(rightConfig
            ? {
                y1: {
                  position: 'right' as const,
                  ...rightBounds,
                  ticks: {
                    color: CHART_TEXT_COLOR,
                    callback: (value: number | string) =>
                      formatYValue(Number(value), rightConfig.label),
                  },
                  grid: { drawOnChartArea: false },
                  border: { color: CHART_TEXT_COLOR },
                  title: {
                    display: true,
                    text: rightConfig.label + (rightConfig.unit ? ` (${rightConfig.unit})` : ''),
                    color: CHART_TEXT_COLOR,
                  },
                },
              }
            : {}),
        },
        plugins: {
          legend: { labels: { color: CHART_TEXT_COLOR } },
          tooltip: {
            callbacks: {
              title: (items) => formatElapsedTime(Number(items[0].parsed.x)),
              label: (item) => {
                const cfg = configs[item.datasetIndex];
                return `${cfg.label}: ${formatYValue(Number(item.parsed.y), cfg.label)}${cfg.unit ? ' ' + cfg.unit : ''}`;
              },
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
  {#if streams.length === 0 || !chartData.data}
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
