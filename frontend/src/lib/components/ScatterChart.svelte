<script lang="ts">
  import { Chart } from 'chart.js';
  import type { AlignedPair } from '../utils/stream-analysis';
  import {
    toXYPoints,
    CHART_TEXT_COLOR,
    CHART_GRID_COLOR,
    type AlignedSeriesData,
  } from '../utils/chart-utils';

  const SCATTER_CHART_HEIGHT = 300;

  interface Props {
    pairs: AlignedPair[];
    regressionLine: { slope: number; intercept: number } | null;
    xLabel: string;
    yLabel: string;
    color: string;
  }

  let { pairs, regressionLine, xLabel, yLabel, color }: Props = $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);
  const chartRef = { current: null as Chart | null };

  const chartData = $derived.by(
    (): { data: AlignedSeriesData | null; axisMin: number; axisMax: number } => {
      if (pairs.length === 0) return { data: null, axisMin: 0, axisMax: 0 };

      // Sort by x for regression line to render correctly
      const sorted = [...pairs].sort((a, b) => a.x - b.x);
      const xs = sorted.map((p) => p.x);
      const ys = sorted.map((p) => p.y);

      // Shared bounds over all finite x and y values, so both axes use the same scale
      const values = [...xs, ...ys].filter(Number.isFinite);
      const axisMin = values.reduce((m, v) => Math.min(m, v), Infinity);
      const axisMax = values.reduce((m, v) => Math.max(m, v), -Infinity);

      if (regressionLine) {
        const { slope, intercept } = regressionLine;
        const regYs: (number | null)[] = xs.map((x) => slope * x + intercept);
        return { data: [xs, ys, regYs] as AlignedSeriesData, axisMin, axisMax };
      }

      return { data: [xs, ys] as AlignedSeriesData, axisMin, axisMax };
    }
  );

  $effect(() => {
    if (!canvasEl || !chartData.data) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const data = chartData.data;
    const { axisMin, axisMax } = chartData;
    const datasets = [
      {
        label: 'Data',
        data: toXYPoints(data, 1),
        backgroundColor: color,
        borderColor: color,
        pointRadius: 2,
        pointHoverRadius: 4,
      },
      ...(regressionLine
        ? [
            {
              label: 'Regression',
              data: toXYPoints(data, 2),
              showLine: true,
              borderColor: '#6b7280',
              borderWidth: 1.5,
              borderDash: [4, 4],
              pointRadius: 0,
              pointHoverRadius: 0,
            },
          ]
        : []),
      {
        label: 'Equal readings',
        data: [
          { x: axisMin, y: axisMin },
          { x: axisMax, y: axisMax },
        ],
        showLine: true,
        borderColor: CHART_TEXT_COLOR,
        borderWidth: 1,
        pointRadius: 0,
        pointHoverRadius: 0,
      },
    ];

    const chart = new Chart(canvasEl, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          x: {
            type: 'linear',
            min: axisMin,
            max: axisMax,
            ticks: {
              color: CHART_TEXT_COLOR,
              callback: (value) => Number(value).toFixed(1),
            },
            grid: { color: CHART_GRID_COLOR },
            border: { color: CHART_TEXT_COLOR },
            title: { display: true, text: xLabel, color: CHART_TEXT_COLOR },
          },
          y: {
            min: axisMin,
            max: axisMax,
            ticks: {
              color: CHART_TEXT_COLOR,
              callback: (value) => Number(value).toFixed(1),
            },
            grid: { color: CHART_GRID_COLOR },
            border: { color: CHART_TEXT_COLOR },
            title: { display: true, text: yLabel, color: CHART_TEXT_COLOR },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            // Show only the first Data item; drops tied duplicates, Regression, and Equal readings
            filter: (item, index, items) =>
              item.datasetIndex === 0 && items.findIndex((i) => i.datasetIndex === 0) === index,
            callbacks: {
              label: (item) =>
                `${item.dataset.label}: (${Number(item.parsed.x).toFixed(1)}, ${Number(item.parsed.y).toFixed(1)})`,
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
  {#if pairs.length === 0}
    <div
      class="flex items-center justify-center rounded-lg border border-border bg-card"
      style="height: {SCATTER_CHART_HEIGHT}px"
    >
      <p class="text-sm text-text-secondary">No data</p>
    </div>
  {:else}
    <div class="w-full" style="height: {SCATTER_CHART_HEIGHT}px">
      <canvas bind:this={canvasEl}></canvas>
    </div>
  {/if}
</div>
