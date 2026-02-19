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
    selectKeyMetrics,
    getGroupedDeduplicatedStats,
    isChartableStream,
    isSmoothVariantToHide,
    getStreamConfig,
  } from '../lib/utils'
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte'
  import StatCard from '../lib/components/StatCard.svelte'
  import TimeSeriesChart from '../lib/components/TimeSeriesChart.svelte'
  import OverlayChart from '../lib/components/OverlayChart.svelte'

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

  /** Key metrics for this activity type (4–6 stats), used in the header bar. */
  const keyMetrics = $derived.by(() => {
    const ev = event
    if (!ev?.stats) return []
    return selectKeyMetrics(ev.stats, mainActivityType)
  })

  type StatEntry = { statType: string; value: string; unit: string }
  const statEntries = $derived.by(() => {
    const ev = event
    if (!ev?.stats) return []
    return Object.entries(ev.stats).map(([statType, raw]) => ({
      statType,
      value: formatStatValue(raw, statType),
      unit: getStatUnit(statType),
    }))
  })

  const groupedStatsSections = $derived(getGroupedDeduplicatedStats(statEntries))

  const keyMetricTypes = $derived(new Set(keyMetrics.map((e) => e.statType)))

  // Selected activity (defaults to first)
  let selectedActivityId = $state<string | null>(null)

  // Activities list
  const activities = $derived(eventDetail?.activities ?? [])

  // Selected activity (or first if none selected)
  const selectedActivity = $derived.by(() => {
    if (selectedActivityId) {
      return activities.find((a) => a.id === selectedActivityId) ?? activities[0] ?? null
    }
    return activities[0] ?? null
  })

  // Initialize selected activity when activities load
  $effect(() => {
    if (activities.length > 0 && !selectedActivityId) {
      selectedActivityId = activities[0].id
    }
  })

  const activityStartDate = $derived(
    selectedActivity?.startDate ?? event?.startDate ?? Date.now()
  )

  // Filter to chartable streams only; hide "X Smooth" when "X" is also present
  const allStreamTypes = $derived(streams.map((s) => s.type))
  const chartableStreams = $derived(
    streams.filter(
      (s) =>
        isChartableStream(s.type) &&
        s.data &&
        s.data.length > 0 &&
        !isSmoothVariantToHide(s.type, allStreamTypes)
    )
  )

  // Heart Rate first, then rest in original order (for toggles and chart order)
  const chartableStreamsOrdered = $derived.by(() => {
    const list = [...chartableStreams]
    const hr = list.find((s) => s.type === 'Heart Rate')
    if (!hr) return list
    return [hr, ...list.filter((s) => s.type !== 'Heart Rate')]
  })

  // Selected streams for visibility toggle (only Heart Rate selected by default)
  let selectedStreamTypes = $state<Set<string>>(new Set())
  let hasInitializedSelection = $state(false)

  // View mode: 'stacked' or 'overlay'
  let viewMode = $state<'stacked' | 'overlay'>('stacked')

  const lastActivityIdRef = { current: null as string | null }

  // When activity changes, allow re-initializing selection for the new activity's streams
  $effect(() => {
    const aid = selectedActivity?.id ?? null
    if (aid !== lastActivityIdRef.current) {
      lastActivityIdRef.current = aid
      hasInitializedSelection = false
    }
  })

  // Initialize selected streams when chartableStreams load: only Heart Rate by default
  $effect(() => {
    if (chartableStreams.length > 0 && !hasInitializedSelection) {
      hasInitializedSelection = true
      const hasHeartRate = chartableStreams.some((s) => s.type === 'Heart Rate')
      selectedStreamTypes = hasHeartRate
        ? new Set(['Heart Rate'])
        : new Set([chartableStreams[0].type])
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

  // Toggle view mode
  function toggleViewMode() {
    viewMode = viewMode === 'stacked' ? 'overlay' : 'stacked'
  }

  // Filter to only selected streams (order: Heart Rate first, then rest)
  const visibleStreams = $derived(
    chartableStreamsOrdered.filter((s) => selectedStreamTypes.has(s.type))
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
    if (!id || !selectedActivity?.id) {
      streams = []
      return
    }

    streamsLoading = true
    streamsError = null
    try {
      const loadedStreams = await getStreams(id, selectedActivity.id)
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

  // Load streams when event and selected activity are available (single effect for initial load and activity switch)
  $effect(() => {
    if (eventDetail && selectedActivity?.id && !loading) {
      loadStreams()
    }
  })
</script>

<section class="mx-auto w-[85%] max-w-screen-2xl py-6">
  <button
    type="button"
    class="mb-4 rounded border border-border px-3 py-1.5 text-base text-text-secondary hover:bg-card-hover hover:text-text-primary"
    onclick={() => push('/')}
  >
    ← Back to Dashboard
  </button>

  {#if loading}
    <div class="flex justify-center py-12">
      <LoadingSpinner />
    </div>
  {:else if error}
    <div class="rounded-md border border-danger/20 bg-danger/10 p-4 backdrop-blur">
      <p class="text-sm font-medium text-danger">{error}</p>
    </div>
  {:else if event}
    <div
      class="overflow-hidden rounded-xl border border-border bg-card shadow-sm backdrop-blur-lg"
    >
      <!-- Header -->
      <div
        class="flex flex-wrap items-center gap-4 border-b border-border px-6 py-5 sm:flex-nowrap"
      >
        <div class="flex flex-1 items-center gap-4 min-w-0">
          <div
            class="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-surface"
          >
            <span class="material-icons text-3xl text-text-primary">
              {activityTypeIcon}
            </span>
            <div
              class="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow"
              title={event.privacy === 'public' ? 'Public' : 'Private'}
            >
              <span class="material-icons text-sm text-text-muted">
                {privacyIcon}
              </span>
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-baseline gap-2 text-lg text-text-primary">
              <span class="font-medium">{formatDate(event.startDate).date}</span>
              <span class="text-sm text-text-secondary">at</span>
              <span class="text-text-secondary">{formatDate(event.startDate).time}</span>
            </div>
            {#if mainActivityType}
              <span
                class="mt-1 inline-block rounded-full bg-surface px-2.5 py-0.5 text-sm font-medium uppercase text-text-secondary"
              >
                {mainActivityType}
              </span>
            {/if}
          </div>
        </div>
        <!-- Key metrics bar -->
        <div class="flex flex-shrink-0 flex-wrap items-center justify-end gap-6">
          {#each keyMetrics as entry (entry.statType)}
            <div class="flex flex-col items-center gap-0.5">
              <span class="text-2xl font-light text-text-primary sm:text-3xl">{entry.value}</span>
              {#if entry.unit}
                <span class="text-xs uppercase tracking-wide text-text-secondary sm:text-sm">
                  {entry.unit}
                </span>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Key metrics bar: 4–6 prominent stat cards -->
      {#if keyMetrics.length > 0}
        <div
          class="grid grid-cols-2 gap-3 border-b border-border px-6 pb-6 sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))]"
        >
          {#each keyMetrics as entry (entry.statType)}
            <StatCard statType={entry.statType} value={entry.value} unit={entry.unit} />
          {/each}
        </div>
      {/if}

      <!-- Grouped stats by category (excluding key metrics already shown above) -->
      <div class="space-y-6 p-6 pt-0">
        {#each groupedStatsSections as section (section.category)}
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
    </div>

    <!-- Stream Charts Section -->
    {#if streamsLoading}
      <div class="mt-6 space-y-6">
        <div class="flex flex-col gap-4">
          <h2 class="text-xl font-semibold text-text-primary">Activity Metrics</h2>
          <!-- Loading skeleton -->
          <div class="space-y-6">
            {#each [1, 2, 3] as _}
              <div
                class="animate-pulse overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm backdrop-blur"
              >
                <div class="h-64 w-full rounded bg-surface"></div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {:else if streamsError}
      <div class="mt-6 rounded-md border border-border bg-card p-4 backdrop-blur">
        <p class="text-sm font-medium text-text-primary">
          {streamsError}
        </p>
        <p class="mt-1 text-xs text-text-secondary">
          Charts will not be available for this activity.
        </p>
      </div>
    {:else if chartableStreams.length > 0}
      <div class="mt-6 space-y-6">
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <div class="flex flex-col gap-2">
              <h2 class="text-xl font-semibold text-text-primary">Activity Metrics</h2>
              
              <!-- Activity Selector Tabs (only show if multiple activities) -->
              {#if activities.length > 1}
                <div class="flex gap-1 border-b border-border">
                  {#each activities as activity (activity.id)}
                    {@const isSelected = selectedActivityId === activity.id}
                    <button
                      type="button"
                      class="px-3 py-2 text-sm font-medium transition-colors {isSelected
                        ? 'border-b-2 border-accent text-accent'
                        : 'text-text-secondary hover:text-text-primary'}"
                      onclick={() => (selectedActivityId = activity.id)}
                    >
                      {activity.name || activity.type || `Activity ${activities.indexOf(activity) + 1}`}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            
            <!-- View Mode Toggle -->
            <div class="flex items-center gap-2">
              <span class="text-sm text-text-secondary">View:</span>
              <button
                type="button"
                class="rounded border px-3 py-1 text-sm transition-colors {viewMode === 'stacked'
                  ? 'border-border bg-card text-text-primary'
                  : 'border-border bg-transparent text-text-secondary hover:bg-card-hover'}"
                onclick={() => (viewMode = 'stacked')}
              >
                Stacked
              </button>
              <button
                type="button"
                class="rounded border px-3 py-1 text-sm transition-colors {viewMode === 'overlay'
                  ? 'border-border bg-card text-text-primary'
                  : 'border-border bg-transparent text-text-secondary hover:bg-card-hover'}"
                onclick={() => (viewMode = 'overlay')}
              >
                Overlay
              </button>
            </div>
          </div>
          
          <!-- Metric Selection Pills -->
          <div class="flex flex-wrap gap-2">
            {#each chartableStreamsOrdered as stream (stream.type)}
              {@const config = getStreamConfig(stream.type)}
              {@const isSelected = selectedStreamTypes.has(stream.type)}
              <button
                type="button"
                class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors {isSelected
                  ? 'text-text-primary'
                  : 'border-border bg-transparent text-text-muted hover:bg-card-hover'}"
                style={isSelected ? `background-color: ${config.color}26; border-color: ${config.color}66` : ''}
                onclick={() => toggleStream(stream.type)}
              >
                <span
                  class="h-2 w-2 rounded-full {isSelected ? '' : 'opacity-40'}"
                  style="background-color: {config.color};"
                ></span>
                <span>{config.label}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Charts for selected metrics -->
        {#if visibleStreams.length > 0}
          {#if viewMode === 'overlay'}
            <!-- Overlay Mode: Single chart with all metrics -->
            <div
              class="overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm backdrop-blur-lg"
            >
              <OverlayChart streams={visibleStreams} activityStartDate={activityStartDate} />
            </div>
          {:else}
            <!-- Stacked Mode: One chart per metric -->
            <div class="space-y-6">
              {#each visibleStreams as stream (stream.type)}
                <div
                  class="overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm backdrop-blur-lg"
                >
                  <TimeSeriesChart streamData={stream} activityStartDate={activityStartDate} />
                </div>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="flex h-32 items-center justify-center rounded-lg border border-border bg-card">
            <p class="text-sm text-text-secondary">
              Select metrics above to view charts
            </p>
          </div>
        {/if}
      </div>
    {:else if selectedActivity && !streamsLoading}
      <!-- No streams available for this activity -->
      <div class="mt-6 rounded-md border border-border bg-card p-4 backdrop-blur">
        <p class="text-sm font-medium text-text-primary">
          No stream data available
        </p>
        <p class="mt-1 text-xs text-text-secondary">
          This activity does not contain time-series data (heart rate, speed, etc.).
        </p>
      </div>
    {/if}
  {:else}
    <p class="text-text-secondary">Event not found.</p>
  {/if}
</section>
