<script lang="ts">
  import { Chart } from 'chart.js';
  import type { DeltaPoint } from '../utils/stream-analysis';
  import {
    formatElapsedTime,
    toXYPoints,
    CHART_TEXT_COLOR,
    CHART_GRID_COLOR,
    type AlignedSeriesData,
  } from '../utils/chart-utils';

  const DELTA_CHART_HEIGHT = 300;

  interface Props {
    deltaSeries: DeltaPoint[];
    label: string;
    color: string;
    unit: string;
  }

  let { deltaSeries, label, color, unit }: Props = $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  const chartRef = { current: null as Chart | null };

  const chartData = $derived.by(
    (): { data: AlignedSeriesData | null; xMin: number; xMax: number } => {
      if (deltaSeries.length === 0) return { data: null, xMin: 0, xMax: 0 };
      const xs = deltaSeries.map((p) => p.x);
      const ys: (number | null)[] = deltaSeries.map((p) => p.y);
      return {
        data: [xs, ys] as AlignedSeriesData,
        xMin: xs[0],
        xMax: xs[xs.length - 1],
      };
    }
  );

  $effect(() => {
    if (!canvasEl || !chartData.data) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const data = chartData.data;
    const chart = new Chart(canvasEl, {
      type: 'line',
      data: {
        datasets: [
          {
            label,
            data: toXYPoints(data, 1),
            borderColor: color,
            borderWidth: 2,
            backgroundColor: color + '28',
            fill: 'start',
            pointRadius: 0,
            pointHoverRadius: 4,
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
              callback: (value) => Number(value).toFixed(1),
            },
            grid: { color: CHART_GRID_COLOR },
            border: { color: CHART_TEXT_COLOR },
            title: {
              display: true,
              text: label + (unit ? ` (${unit})` : ''),
              color: CHART_TEXT_COLOR,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => formatElapsedTime(Number(items[0].parsed.x)),
              label: (item) =>
                `${item.dataset.label}: ${Number(item.parsed.y).toFixed(1)}${unit ? ' ' + unit : ''}`,
            },
          },
        },
      },
    });
    chartRef.current = chart;

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  });
</script>

<div class="w-full">
  {#if deltaSeries.length === 0}
    <div
      class="flex items-center justify-center rounded-lg border border-border bg-card"
      style="height: {DELTA_CHART_HEIGHT}px"
    >
      <p class="text-sm text-text-secondary">No delta data</p>
    </div>
  {:else}
    <div class="w-full" style="height: {DELTA_CHART_HEIGHT}px">
      <canvas bind:this={canvasEl}></canvas>
    </div>
  {/if}
</div>
