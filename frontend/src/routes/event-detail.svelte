<script lang="ts">
  interface Props {
    params?: { id?: string }
  }
  let { params = {} }: Props = $props()

  import { push } from 'svelte-spa-router'
  import { getEvent } from '../lib/api'
  import type { EventDetail as EventDetailType } from '../lib/types'
  import {
    formatDate,
    getActivityIcon,
    getStatUnit,
    formatStatValue,
    groupStatsByCategory,
  } from '../lib/utils'
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte'
  import StatCard from '../lib/components/StatCard.svelte'

  const id = $derived(params?.id ?? '')

  let eventDetail = $state<EventDetailType | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)
  const event = $derived(eventDetail?.event ?? null)

  const mainActivityType = $derived.by(() => {
    const ev = event
    if (!ev) return ''
    const activities = eventDetail?.activities ?? []
    const fromActivities = activities[0]?.type
    if (fromActivities) return fromActivities
    const activityTypes = ev.stats?.['Activity Types']
    if (Array.isArray(activityTypes) && activityTypes.length > 0) return String(activityTypes[0])
    if (typeof activityTypes === 'string') return activityTypes
    return ''
  })

  const activityTypeIcon = $derived(getActivityIcon(mainActivityType))

  const privacyIcon = $derived(event?.privacy === 'public' ? 'public' : 'lock')

  /** Hero stat types by activity: Virtual Cycling -> Duration+Power; indoor -> Duration+Energy; else Distance+Duration. */
  const heroStatTypes = $derived.by(() => {
    const type = mainActivityType
    if (!type) return ['Distance', 'Duration']
    const t = type.toLowerCase()
    if (t === 'virtual cycling' || t === 'virtualride') return ['Duration', 'Average Power']
    if (
      t.includes('weight') ||
      t.includes('strength') ||
      t.includes('gym') ||
      t.includes('indoor')
    ) {
      return ['Duration', 'Energy']
    }
    return ['Distance', 'Duration']
  })

  const heroStats = $derived.by(() => {
    const ev = event
    if (!ev?.stats) return []
    const stats: { value: string; unit: string; type: string }[] = []
    for (const statType of heroStatTypes) {
      const key = Object.keys(ev.stats).find(
        (k) => k.toLowerCase() === statType.toLowerCase()
      )
      if (!key) continue
      const raw = ev.stats[key]
      if (raw == null) continue
      stats.push({
        value: formatStatValue(raw),
        unit: getStatUnit(key),
        type: key,
      })
    }
    return stats
  })

  type StatEntry = { statType: string; value: string; unit: string }
  const statEntries = $derived.by(() => {
    const ev = event
    if (!ev?.stats) return []
    return Object.entries(ev.stats).map(([statType, raw]) => ({
      statType,
      value: formatStatValue(raw),
      unit: getStatUnit(statType),
    }))
  })

  const groupedStats = $derived(groupStatsByCategory(statEntries))

  async function loadEvent() {
    if (!id) {
      eventDetail = null
      loading = false
      return
    }
    loading = true
    error = null
    try {
      eventDetail = await getEvent(id)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Event not found'
      eventDetail = null
    } finally {
      loading = false
    }
  }

  $effect(() => {
    if (id) loadEvent()
  })
</script>

<section class="max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
  <button
    type="button"
    class="mb-4 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
    onclick={() => push('/')}
  >
    ← Back to Dashboard
  </button>

  {#if loading}
    <div class="flex justify-center py-12">
      <LoadingSpinner />
    </div>
  {:else if error}
    <div class="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
      <p class="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
    </div>
  {:else if event}
    <div
      class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    >
      <!-- Header -->
      <div
        class="flex flex-wrap items-center gap-4 border-b border-gray-200 px-6 py-5 dark:border-gray-700 sm:flex-nowrap"
      >
        <div class="flex flex-1 items-center gap-4 min-w-0">
          <div
            class="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700"
          >
            <span class="material-icons text-3xl text-gray-700 dark:text-gray-300">
              {activityTypeIcon}
            </span>
            <div
              class="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow dark:bg-gray-800"
              title={event.privacy === 'public' ? 'Public' : 'Private'}
            >
              <span class="material-icons text-sm text-gray-600 dark:text-gray-400">
                {privacyIcon}
              </span>
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-baseline gap-2 text-gray-900 dark:text-white">
              <span class="font-medium">{formatDate(event.startDate).date}</span>
              <span class="text-sm text-gray-500 dark:text-gray-400">at</span>
              <span class="text-gray-600 dark:text-gray-300">{formatDate(event.startDate).time}</span>
            </div>
            {#if mainActivityType}
              <span
                class="mt-1 inline-block rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium uppercase text-gray-700 dark:bg-gray-600 dark:text-gray-300"
              >
                {mainActivityType}
              </span>
            {/if}
          </div>
        </div>
        <!-- Hero metrics -->
        <div class="flex flex-shrink-0 items-center gap-8">
          {#each heroStats as hero}
            <div class="flex flex-col items-center gap-0.5">
              <span class="text-2xl font-light text-gray-900 dark:text-white">{hero.value}</span>
              <span class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {hero.unit}
              </span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Stats grid -->
      <div class="grid grid-cols-2 gap-3 p-6 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
        {#each [...groupedStats.overall, ...groupedStats.performance, ...groupedStats.physiological] as entry (entry.statType)}
          <StatCard statType={entry.statType} value={entry.value} unit={entry.unit} />
        {/each}
      </div>
    </div>
  {:else}
    <p class="text-gray-500 dark:text-gray-400">Event not found.</p>
  {/if}
</section>
