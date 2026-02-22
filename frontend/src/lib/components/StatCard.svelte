<script lang="ts">
  interface Props {
    statType: string
    value: string
    unit: string
  }
  let { statType, value, unit }: Props = $props()

  import { getStatIcon, getStatIconMaterialName, getStatLabel } from '../utils/stat-icons'

  const icon = $derived(getStatIcon(statType))
</script>

{#if icon}
  <div
    class="flex items-center gap-3 rounded-xl border border-border bg-card p-3 backdrop-blur"
  >
    <span class="material-icons text-xl text-text-muted">
      {getStatIconMaterialName(icon)}
    </span>
    <div class="min-w-0 flex-1">
      <div class="text-sm font-medium uppercase tracking-wide text-text-secondary">
        {getStatLabel(statType)}
      </div>
      <div class="text-base font-medium text-text-primary">
        {value}{#if unit} {unit}{/if}
      </div>
    </div>
  </div>
{/if}
