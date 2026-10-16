<script lang="ts">
  interface Props {
    statType: string;
    value: string;
    unit: string;
  }
  let { statType, value, unit }: Props = $props();

  import {
    getStatIcon,
    getStatIconColor,
    getStatIconMaterialName,
    getStatLabel,
  } from '../utils/stat-icons';

  const icon = $derived(getStatIcon(statType));
</script>

{#if icon}
  <div class="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
    <span class="material-icons text-xl {getStatIconColor(statType)}">
      {getStatIconMaterialName(icon)}
    </span>
    <div class="min-w-0 flex-1">
      <div class="text-sm font-medium uppercase tracking-wide text-text-secondary">
        {getStatLabel(statType)}
      </div>
      <div class="font-mono text-base font-medium tabular-nums text-text-primary">
        {value}{#if unit}
          {unit}{/if}
      </div>
    </div>
  </div>
{/if}
