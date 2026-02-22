<script lang="ts">
  import StatCard from '../StatCard.svelte'

  interface StatEntry {
    statType: string
    value: string
    unit: string
  }

  interface GroupedSection {
    category: string
    entries: StatEntry[]
  }

  interface Props {
    hasMoreStats: boolean
    open?: boolean
    groupedSections: GroupedSection[]
    keyMetricTypes: Set<string>
    onToggle: () => void
  }
  let { hasMoreStats, open = false, groupedSections, keyMetricTypes, onToggle }: Props = $props()
</script>

{#if hasMoreStats}
  <div class="border-t border-border px-6">
    <button
      type="button"
      class="flex w-full items-center justify-end gap-1.5 py-4 text-right text-sm font-medium text-text-primary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      onclick={onToggle}
      aria-expanded={open}
    >
      <span>More stats</span>
      <span
        class="relative inline-flex h-8 w-8 flex-shrink-0 items-center justify-center text-2xl font-medium tabular-nums text-text-primary transition-opacity duration-200"
        aria-hidden="true"
      >
        <span
          class="absolute inset-0 flex items-center justify-center transition-opacity duration-200 {open ? 'opacity-0' : 'opacity-100'}"
        >
          +
        </span>
        <span
          class="absolute inset-0 flex items-center justify-center transition-opacity duration-200 {open ? 'opacity-100' : 'opacity-0'}"
        >
          −
        </span>
      </span>
    </button>
    {#if open}
      <div class="space-y-6 pb-6 pt-0">
        {#each groupedSections as section (section.category)}
          {@const entries = section.entries.filter((e) => !keyMetricTypes.has(e.statType))}
          {#if entries.length > 0}
            <section>
              <h3
                class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary"
              >
                {section.category}
              </h3>
              <div
                class="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]"
              >
                {#each entries as entry (entry.statType)}
                  <StatCard statType={entry.statType} value={entry.value} unit={entry.unit} />
                {/each}
              </div>
            </section>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
{/if}
