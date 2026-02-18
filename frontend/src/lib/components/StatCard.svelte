<script lang="ts">
  interface Props {
    statType: string
    value: string
    unit: string
  }
  let { statType, value, unit }: Props = $props()

  import { getStatIcon, getStatIconMaterialName, getStatLabel } from '../utils/stats'

  const icon = $derived(getStatIcon(statType))
</script>

{#if icon}
  <div
    class="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700/50"
  >
    <span class="material-icons text-xl text-gray-500 dark:text-gray-400">
      {getStatIconMaterialName(icon)}
    </span>
    <div class="min-w-0 flex-1">
      <div class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {getStatLabel(statType)}
      </div>
      <div class="text-sm font-medium text-gray-900 dark:text-white">
        {value} {unit}
      </div>
    </div>
  </div>
{/if}
