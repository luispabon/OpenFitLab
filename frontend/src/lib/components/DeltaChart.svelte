<script lang="ts">
  import uPlot from 'uplot';
  import 'uplot/dist/uPlot.min.css';
  import type { DeltaPoint } from '../utils/stream-analysis';
  import { formatElapsedTime, CHART_TEXT_COLOR, CHART_GRID_COLOR } from '../utils/chart-utils';

  const DELTA_CHART_HEIGHT = 300;

  interface Props {
    deltaSeries: DeltaPoint[];
    label: string;
    color: string;
    unit: string;
  }

  let { deltaSeries, label, color, unit }: Props = $props();

  let containerEl: HTMLDivElement | null = $state(null);
  const chartRef = { current: null as uPlot | null };

  const chartData = $derived.by(
    (): { data: uPlot.AlignedData | null; xMin: number; xMax: number } => {
      if (deltaSeries.length === 0) return { data: null, xMin: 0, xMax: 0 };
      const xs = deltaSeries.map((p) => p.x);
      const ys: (number | null)[] = deltaSeries.map((p) => p.y);
      return {
        data: [xs, ys] as uPlot.AlignedData,
        xMin: xs[0],
        xMax: xs[xs.length - 1],
      };
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

    const opts: uPlot.Options = {
      width: containerEl.offsetWidth,
      height: DELTA_CHART_HEIGHT,
      series: [
        {},
        {
          label,
          stroke: color,
          width: 2,
          fill: color + '28',
          value: (_u, raw) => (raw == null ? '' : `${raw.toFixed(1)}${unit ? ' ' + unit : ''}`),
        },
      ],
      scales: {
        x: { time: false, auto: true },
        y: { auto: true },
      },
      axes: [
        {
          stroke: textColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: textColor },
          values: (_u, ticks) => ticks.map((t) => formatElapsedTime(t)),
          label: 'Elapsed Time',
          labelFont: '12px system-ui',
          font: '12px system-ui',
          size: 36,
          gap: 8,
          space: 44,
        },
        {
          stroke: textColor,
          grid: { stroke: gridColor, width: 1 },
          ticks: { stroke: textColor },
          values: (_u, ticks) => ticks.map((t) => (typeof t === 'number' ? t.toFixed(1) : '')),
          label: label + (unit ? ` (${unit})` : ''),
          labelFont: '12px system-ui',
          font: '12px system-ui',
          size: 36,
          gap: 5,
          space: 60,
          labelGap: 12,
          labelSize: 40,
        },
      ],
      legend: { show: false },
      hooks: {
        draw: [
          (u) => {
            const y0 = u.valToPos(0, 'y', true);
            const ctx = u.ctx;
            const left = u.bbox.left;
            const width = u.bbox.width;
            ctx.save();
            ctx.strokeStyle = '#9ca3af';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(left, y0);
            ctx.lineTo(left + width, y0);
            ctx.stroke();
            ctx.restore();
          },
        ],
      },
    };

    const u = new uPlot(opts, data!, containerEl);
    chartRef.current = u;

    const ro = new ResizeObserver(() => {
      if (chartRef.current && containerEl) {
        chartRef.current.setSize({ width: containerEl.offsetWidth, height: DELTA_CHART_HEIGHT });
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
  {#if deltaSeries.length === 0}
    <div
      class="flex items-center justify-center rounded-lg border border-border bg-card"
      style="height: {DELTA_CHART_HEIGHT}px"
    >
      <p class="text-sm text-text-secondary">No delta data</p>
    </div>
  {:else}
    <div class="w-full" bind:this={containerEl}></div>
  {/if}
</div>
