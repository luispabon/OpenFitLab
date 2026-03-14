<script lang="ts">
  import type {
    AlignedPair,
    DeltaPoint,
    LinearRegression,
    StreamAnalysisStats,
  } from '../../utils/stream-analysis';
  import type { StreamConfig } from '../../utils/stream-config';
  import ScatterChart from '../ScatterChart.svelte';
  import DeltaChart from '../DeltaChart.svelte';
  import ExportButton from '../ExportButton.svelte';
  import { exportAsPng } from '../../utils/export-image';

  interface Props {
    refDeviceName: string;
    secDeviceName: string;
    streamConfig: StreamConfig;
    secColor: string;
    pairs: AlignedPair[];
    regression: LinearRegression;
    stats: StreamAnalysisStats;
    deltaData: DeltaPoint[];
  }
  let {
    refDeviceName,
    secDeviceName,
    streamConfig,
    secColor,
    pairs,
    regression,
    stats,
    deltaData,
  }: Props = $props();

  let cardEl = $state<HTMLElement | null>(null);

  function getCorrelationRating(r: number): { label: string; color: string } {
    const abs = Math.abs(r);
    if (abs >= 0.9) return { label: 'Excellent', color: '#22c55e' };
    if (abs >= 0.7) return { label: 'Good', color: '#84cc16' };
    if (abs >= 0.5) return { label: 'Moderate', color: '#eab308' };
    if (abs >= 0.3) return { label: 'Weak', color: '#f97316' };
    return { label: 'Poor', color: '#ef4444' };
  }
</script>

<div
  bind:this={cardEl}
  class="overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm"
>
  <div class="mb-4 flex items-center justify-between">
    <h3 class="text-base font-semibold text-text-primary">
      {refDeviceName} vs {secDeviceName}
      <span class="ml-2 text-sm font-normal text-text-secondary">({streamConfig.label})</span>
    </h3>
    {#if cardEl}
      <ExportButton
        onExport={() =>
          exportAsPng(
            cardEl!,
            `${refDeviceName}-vs-${secDeviceName}-${streamConfig.label}`
              .toLowerCase()
              .replace(/\s+/g, '-')
          )}
        title="Export analysis as PNG"
      />
    {/if}
  </div>

  {#if pairs.length < 2}
    <div class="flex items-center justify-center rounded-lg border border-border bg-surface p-6">
      <p class="text-sm text-text-secondary">Not enough overlapping data for analysis</p>
    </div>
  {:else}
    {@const rating = getCorrelationRating(stats.r)}
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Scatter chart -->
      <div class="flex flex-col">
        <p
          class="mb-2 flex min-h-[3rem] items-start text-xs font-medium uppercase tracking-wider text-text-secondary"
        >
          Scatter / Correlation
          <span
            class="ml-2 inline-flex flex-col items-center rounded px-2 py-0.5 leading-tight align-middle"
            style="background-color: {rating.color}26; color: {rating.color};"
          >
            <span class="font-mono text-sm font-bold">{stats.r.toFixed(3)}</span>
            <span class="text-[9px] font-semibold uppercase tracking-wide">{rating.label}</span>
          </span>
        </p>
        <ScatterChart
          {pairs}
          regressionLine={regression}
          xLabel="{streamConfig.label} — {refDeviceName}{streamConfig.unit
            ? ' (' + streamConfig.unit + ')'
            : ''}"
          yLabel="{streamConfig.label} — {secDeviceName}{streamConfig.unit
            ? ' (' + streamConfig.unit + ')'
            : ''}"
          color={secColor}
        />
      </div>

      <!-- Delta chart -->
      <div class="flex flex-col">
        <p
          class="mb-2 flex min-h-[3rem] items-start text-xs font-medium uppercase tracking-wider text-text-secondary"
        >
          Delta over time ({secDeviceName} − {refDeviceName})
        </p>
        <DeltaChart
          deltaSeries={deltaData}
          label="{streamConfig.label} delta"
          color={secColor}
          unit={streamConfig.unit}
        />
      </div>
    </div>

    <!-- Stats row -->
    <div
      class="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-5"
    >
      <div class="text-center">
        <p class="text-xs text-text-secondary">Pearson r</p>
        <p class="mt-0.5 font-mono text-sm font-medium text-text-primary">
          {stats.r.toFixed(3)}
        </p>
      </div>
      <div class="text-center">
        <p class="text-xs text-text-secondary">R²</p>
        <p class="mt-0.5 font-mono text-sm font-medium text-text-primary">
          {stats.r2.toFixed(3)}
        </p>
      </div>
      <div class="text-center">
        <p class="text-xs text-text-secondary">Mean diff</p>
        <p class="mt-0.5 font-mono text-sm font-medium text-text-primary">
          {stats.meanDiff >= 0 ? '+' : ''}{stats.meanDiff.toFixed(1)}{streamConfig.unit
            ? ' ' + streamConfig.unit
            : ''}
        </p>
      </div>
      <div class="text-center">
        <p class="text-xs text-text-secondary">Max |diff|</p>
        <p class="mt-0.5 font-mono text-sm font-medium text-text-primary">
          {stats.maxAbsDiff.toFixed(1)}{streamConfig.unit ? ' ' + streamConfig.unit : ''}
        </p>
      </div>
      <div class="text-center">
        <p class="text-xs text-text-secondary">Points (n)</p>
        <p class="mt-0.5 font-mono text-sm font-medium text-text-primary">{stats.n}</p>
      </div>
    </div>
  {/if}
</div>
