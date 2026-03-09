<script lang="ts">
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import type { AlignedPair } from '../utils/stream-analysis';
  import { CHART_TEXT_COLOR, CHART_GRID_COLOR } from '../utils/chart-utils';

  const SCATTER_CHART_HEIGHT = 300;

  interface Props {
    pairs: AlignedPair[];
    regressionLine: { slope: number; intercept: number } | null;
    xLabel: string;
    yLabel: string;
    color: string;
  }

  let { pairs, regressionLine, xLabel, yLabel, color }: Props = $props();

  let containerEl: HTMLDivElement | null = $state(null);
  const chartRef = { current: null as uPlot | null };

  const chartData = $derived.by(
    (): { data: uPlot.AlignedData | null; xMin: number; xMax: number } => {
      if (pairs.length === 0) return { data: null, xMin: 0, xMax: 0 };

      // Sort by x for regression line to render correctly
      const sorted = [...pairs].sort((a, b) => a.x - b.x);
      const xs = sorted.map((p) => p.x);
      const ys = sorted.map((p) => p.y);

      const xMin = xs[0];
      const xMax = xs[xs.length - 1];

      if (regressionLine) {
        const { slope, intercept } = regressionLine;
        const regYs: (number | null)[] = xs.map((x) => slope * x + intercept);
        return { data: [xs, ys, regYs] as uPlot.AlignedData, xMin, xMax };
      }

      return { data: [xs, ys] as uPlot.AlignedData, xMin, xMax };
    }
  );

  $effect(() => {
    if (!containerEl || !chartData.data) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    const textColor = CHART_TEXT_COLOR;
    const gridColor = CHART_GRID_COLOR;
    const { data } = chartData;

    const series: uPlot.Series[] = [{}];

    // Scatter series
    series.push({
      label: 'Data',
      stroke: color,
      width: 0,
      points: { show: true, size: 4, width: 0, fill: color },
    });

    // Regression line series (if provided)
    if (regressionLine) {
      series.push({
        label: 'Regression',
        stroke: '#6b7280',
        width: 1.5,
        points: { show: false },
        dash: [4, 4],
      });
    }

    const opts: uPlot.Options = {
      width: containerEl.offsetWidth,
      height: SCATTER_CHART_HEIGHT,
      series,
      scales: {
        x: { time: false, auto: true },
        y: { auto: true },
      },
      axes: [
        {
          stroke: textColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: textColor },
          values: (_u, ticks) => ticks.map((t) => (typeof t === 'number' ? t.toFixed(1) : '')),
          label: xLabel,
          labelFont: '12px system-ui',
          font: '12px system-ui',
          size: 36,
          gap: 8,
          space: 50,
        },
        {
          stroke: textColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: textColor },
          values: (_u, ticks) => ticks.map((t) => (typeof t === 'number' ? t.toFixed(1) : '')),
          label: yLabel,
          labelFont: '12px system-ui',
          font: '12px system-ui',
          size: 36,
          gap: 5,
          space: 50,
          labelGap: 12,
          labelSize: 40,
        },
      ],
      legend: { show: false },
    };

    const u = new uPlot(opts, data!, containerEl);
    chartRef.current = u;

    const ro = new ResizeObserver(() => {
      if (chartRef.current && containerEl) {
        chartRef.current.setSize({ width: containerEl.offsetWidth, height: SCATTER_CHART_HEIGHT });
      }
    });
    ro.observe(containerEl);

    return () => {
      ro.disconnect();
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
    <div class="w-full" bind:this={containerEl}></div>
  {/if}
</div>
