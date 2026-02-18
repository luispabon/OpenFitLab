<script lang="ts">
  interface Props {
    params?: { id?: string }
  }
  let { params = {} }: Props = $props()

  import { push } from 'svelte-spa-router'
  import { getEvent, getStreams } from '../lib/api'
  import type { EventDetail as EventDetailType, StreamData } from '../lib/types'
  import {
    formatDate,
    getActivityIcon,
    getStatUnit,
    formatStatValue,
    groupStatsByCategory,
    isChartableStream,
    getStreamConfig,
  } from '../lib/utils'
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte'
  import StatCard from '../lib/components/StatCard.svelte'
  import TimeSeriesChart from '../lib/components/TimeSeriesChart.svelte'

  const id = $derived(params?.id ?? '')

  let eventDetail = $state<EventDetailType | null>(null)
  let loading = $state(true)
  let error = $state<string | null>(null)
  let streams = $state<StreamData[]>([])
  let streamsLoading = $state(false)
  let streamsError = $state<string | null>(null)
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

  // Get first activity for stream loading
  const firstActivity = $derived(eventDetail?.activities?.[0] ?? null)
  const activityStartDate = $derived(firstActivity?.startDate ?? event?.startDate ?? Date.now())

  // Filter to chartable streams only
  const chartableStreams = $derived(
    streams.filter((s) => isChartableStream(s.type) && s.data && s.data.length > 0)
  )

  // Selected streams for visibility toggle (all selected by default)
  let selectedStreamTypes = $state<Set<string>>(new Set())

  // Initialize selected streams when chartableStreams change (all selected by default)
  $effect(() => {
    if (chartableStreams.length > 0 && selectedStreamTypes.size === 0) {
      selectedStreamTypes = new Set(chartableStreams.map((s) => s.type))
    }
  })

  // Toggle stream visibility
  function toggleStream(type: string) {
    const newSet = new Set(selectedStreamTypes)
    if (newSet.has(type)) {
      newSet.delete(type)
    } else {
      newSet.add(type)
    }
    selectedStreamTypes = newSet
  }

  // Filter to only selected streams
  const visibleStreams = $derived(
    chartableStreams.filter((s) => selectedStreamTypes.has(s.type))
  )

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

  async function loadStreams() {
    if (!id || !firstActivity?.id) {
      streams = []
      return
    }

    streamsLoading = true
    streamsError = null
    try {
      const loadedStreams = await getStreams(id, firstActivity.id)
      streams = loadedStreams
    } catch (e) {
      streamsError = e instanceof Error ? e.message : 'Failed to load streams'
      streams = []
    } finally {
      streamsLoading = false
    }
  }

  // Load event when ID changes
  $effect(() => {
    if (id) loadEvent()
  })

  // Load streams when event and first activity are available
  $effect(() => {
    if (eventDetail && firstActivity?.id && !loading) {
      loadStreams()
    }
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

    <!-- Stream Charts Section -->
    {#if streamsLoading}
      <div class="mt-6 flex justify-center py-12">
        <LoadingSpinner />
      </div>
    {:else if streamsError}
      <div class="mt-6 rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/20">
        <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
          {streamsError}
        </p>
      </div>
    {:else if chartableStreams.length > 0}
      <div class="mt-6 space-y-6">
        <div class="flex flex-col gap-4">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Activity Metrics</h2>
          
          <!-- Metric Selection Pills -->
          <div class="flex flex-wrap gap-2">
            {#each chartableStreams as stream (stream.type)}
              {@const config = getStreamConfig(stream.type)}
              {@const isSelected = selectedStreamTypes.has(stream.type)}
              <button
                type="button"
                class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors {isSelected
                  ? 'border-gray-300 bg-gray-100 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}"
                onclick={() => toggleStream(stream.type)}
              >
                <span
                  class="h-2 w-2 rounded-full"
                  style="background-color: {config.color};"
                ></span>
                <span>{config.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Charts for selected metrics -->
        {#if visibleStreams.length > 0}
          <div class="space-y-6">
            {#each visibleStreams as stream (stream.type)}
              <div
                class="overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <TimeSeriesChart streamData={stream} activityStartDate={activityStartDate} />
              </div>
            {/each}
          </div>
        {:else}
          <div class="flex h-32 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Select metrics above to view charts
            </p>
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <p class="text-gray-500 dark:text-gray-400">Event not found.</p>
  {/if}
</section>
