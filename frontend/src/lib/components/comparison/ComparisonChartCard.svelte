<script lang="ts">
  import type { ComparisonChartEntry } from '../../utils/comparison-chart-data';
  import ComparisonChart from '../ComparisonChart.svelte';
  import ExportButton from '../ExportButton.svelte';
  import { exportAsPng } from '../../utils/export-image';
  import { getStreamConfig } from '../../utils/stream-config';

  interface Props {
    streamType: string;
    entries: ComparisonChartEntry[];
    xAxisMode: 'elapsed' | 'wall-clock';
  }
  let { streamType, entries, xAxisMode }: Props = $props();

  let cardEl = $state<HTMLElement | null>(null);
</script>

{#if entries.length > 0}
  <div
    bind:this={cardEl}
    class="overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm backdrop-blur-lg"
  >
    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-lg font-semibold text-text-primary">
        {getStreamConfig(streamType).label}
      </h3>
      {#if cardEl}
        <ExportButton
          onExport={() =>
            exportAsPng(cardEl!, `${streamType.toLowerCase().replace(/\s+/g, '-')}-comparison`)}
          title="Export chart as PNG"
        />
      {/if}
    </div>
    <ComparisonChart {streamType} {entries} {xAxisMode} />
  </div>
{/if}
