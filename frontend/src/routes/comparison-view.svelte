<script lang="ts">
  interface Props {
    params?: { id?: string }
    query?: { events?: string }
  }
  let { params = {}, query = {} }: Props = $props()

  import { push, replace, location } from 'svelte-spa-router'
  import { getEvent, getStreams, getComparison, createComparison, deleteComparison } from '../lib/api'
  import type { EventDetail, StreamData, Comparison, ComparisonSettings } from '../lib/types'
  import { isChartableStream, isSmoothVariantToHide, getStreamConfig, getActivityDeviceName, hasLocationStreams } from '../lib/utils'
  import { parseStat } from '../lib/utils/stat-parsing'
  import { keepStatByPreferredUnit, metricAggregationKeyNormalized } from '../lib/utils/stat-categories'
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte'
  import ComparisonChart from '../lib/components/ComparisonChart.svelte'
  import ComparisonStatsTable from '../lib/components/comparison/ComparisonStatsTable.svelte'
  import RouteMap from '../lib/components/RouteMap.svelte'

  const comparisonId = $derived(params?.id ?? '')
  
  // Parse query parameters from URL hash - use state that updates reactively
  // svelte-spa-router uses hash-based routing, so query params are in the hash fragment
  let eventIdsFromQueryState = $state<string[]>([])
  
  // Update eventIdsFromQueryState when location changes
  $effect(() => {
    const loc = $location // Access location to trigger reactivity
    
    // First try the query prop (if svelte-spa-router provides it)
    if (query?.events) {
      const ids = query.events.split(',').map(id => id.trim()).filter(id => id.length > 0)
      const idsStr = ids.slice().sort().join(',')
      const currentStr = eventIdsFromQueryState.slice().sort().join(',')
      // Only update if changed
      if (idsStr !== currentStr) {
        eventIdsFromQueryState = ids
      }
      return
    }
    
    try {
      // Parse from window.location.hash since svelte-spa-router uses hash routing
      // Hash format: #/compare/new?events=id1,id2
      const hash = window.location.hash
      const hashMatch = hash.match(/\?events=([^&]+)/)
      if (hashMatch && hashMatch[1]) {
        const eventsParam = decodeURIComponent(hashMatch[1])
        const ids = eventsParam.split(',').map(id => id.trim()).filter(id => id.length > 0)
        const idsStr = ids.slice().sort().join(',')
        const currentStr = eventIdsFromQueryState.slice().sort().join(',')
        // Only update if changed
        if (idsStr !== currentStr) {
          eventIdsFromQueryState = ids
        }
      } else {
        // Only update if not already empty
        if (eventIdsFromQueryState.length > 0) {
          eventIdsFromQueryState = []
        }
      }
    } catch (e) {
      // Silently handle errors - only update if needed
      if (eventIdsFromQueryState.length > 0) {
        eventIdsFromQueryState = []
      }
    }
  })
  
  const eventIdsFromQuery = $derived(eventIdsFromQueryState)

  // Event color palette (distinct colors for up to 6 events)
  const EVENT_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899']

  let savedComparison = $state<Comparison | null>(null)
  let events = $state<EventDetail[]>([])
  let streamsByEventId = $state<Record<string, StreamData[]>>({})
  let selectedActivities = $state<Record<string, string>>({}) // eventId -> activityId
  let loading = $state(false) // Start as false, will be set to true when loading starts
  let error = $state<string | null>(null)
  let xAxisMode = $state<'elapsed' | 'wall-clock'>('elapsed')
  let selectedStreamTypes = $state<Set<string>>(new Set())
  let showSaveDialog = $state(false)
  let saveName = $state('')
  let isSaving = $state(false)
  let isDeleting = $state(false)
  
  // Track what we've loaded to prevent infinite loops
  let loadedComparisonId = $state<string | null>(null)
  let loadedEventIds = $state<string[]>([])
  let loadedStreamsSignature = $state<string>('') // Track which activities we've loaded streams for
  let lastLoadAttempt = $state<string>('') // Track the last event IDs we attempted to load

  // Determine event IDs: from saved comparison or query string
  const eventIds = $derived.by(() => {
    if (comparisonId && comparisonId !== 'new' && savedComparison) {
      return savedComparison.eventIds
    }
    return eventIdsFromQuery.filter((id) => id.trim().length > 0)
  })

  // Show spinner when viewing a saved comparison by ID but comparison not loaded yet (e.g. after save + replace)
  const loadingComparison = $derived(
    Boolean(comparisonId && comparisonId !== 'new' && savedComparison === null && !error)
  )

  // Load saved comparison if viewing by ID
  async function loadSavedComparison() {
    if (!comparisonId || comparisonId === 'new') {
      savedComparison = null
      loadedComparisonId = null
      return
    }
    
    // Don't reload if we've already loaded this comparison
    if (loadedComparisonId === comparisonId && savedComparison) {
      return
    }

    try {
      const comp = await getComparison(comparisonId)
      savedComparison = comp
      loadedComparisonId = comparisonId
      if (comp.settings) {
        xAxisMode = comp.settings.xAxisMode ?? 'elapsed'
        selectedStreamTypes = new Set(comp.settings.selectedStreams ?? [])
        selectedActivities = comp.settings.selectedActivities ?? {}
      }
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load comparison'
      savedComparison = null
      loadedComparisonId = null
      loading = false
    }
  }

  // Load all events
  async function loadEvents() {
    if (eventIds.length < 2) {
      error = 'At least 2 events are required for comparison'
      loading = false
      return
    }
    
    // Don't reload if we've already loaded these exact event IDs
    const eventIdsStr = eventIds.slice().sort().join(',')
    const loadedEventIdsStr = loadedEventIds.slice().sort().join(',')
    if (loadedEventIdsStr === eventIdsStr && events.length > 0) {
      loading = false
      return
    }
    
    // Prevent concurrent loads - check this AFTER checking if already loaded
    if (loading) {
      return
    }

    loading = true
    error = null
    // Reset loaded streams signature when loading new events
    loadedStreamsSignature = ''

    try {
      const loadedEvents = await Promise.all(eventIds.map((id) => getEvent(id)))
      events = loadedEvents
      loadedEventIds = [...eventIds]
      // Update lastLoadAttempt to match what we just loaded
      lastLoadAttempt = eventIds.slice().sort().join(',')

      // Initialize selected activities (use saved or default to first)
      let activitiesChanged = false
      const nextActivities = { ...selectedActivities }
      for (const eventDetail of events) {
        const eventId = eventDetail.event.id
        if (!nextActivities[eventId] && eventDetail.activities.length > 0) {
          nextActivities[eventId] = eventDetail.activities[0].id
          activitiesChanged = true
        }
      }
      if (activitiesChanged) selectedActivities = nextActivities

      // Load streams for all selected activities
      // Reset signature if activities changed to force reload
      if (activitiesChanged) {
        loadedStreamsSignature = ''
      }
      await loadStreams()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load events'
      events = []
      loadedEventIds = []
    } finally {
      loading = false
    }
  }

  // Load streams for all selected activities
  async function loadStreams() {
    // Check if we already have streams for these exact activities
    const currentActivityIds = events.map((e) => {
      const eventId = e.event.id
      return `${eventId}:${selectedActivities[eventId] || ''}`
    }).sort().join('|')
    
    // Don't reload if we've already loaded streams for these activities
    if (loadedStreamsSignature === currentActivityIds && Object.keys(streamsByEventId).length > 0) {
      return
    }
    
    // Create a signature of what we're about to load
    const streamsToLoad: Record<string, StreamData[]> = {}

    await Promise.all(
      events.map(async (eventDetail) => {
        const eventId = eventDetail.event.id
        const activityId = selectedActivities[eventId]
        if (!activityId) return

        try {
          const loadedStreams = await getStreams(eventId, activityId)
          streamsToLoad[eventId] = loadedStreams
        } catch (e) {
          console.error(`Failed to load streams for event ${eventId}:`, e)
          streamsToLoad[eventId] = []
        }
      })
    )

    // Update state and signature
    streamsByEventId = streamsToLoad
    loadedStreamsSignature = currentActivityIds

    // Initialize selected streams if not set (default to Heart Rate if available)
    if (selectedStreamTypes.size === 0) {
      const allStreamTypes = new Set<string>()
      for (const streamList of Object.values(streamsToLoad)) {
        for (const stream of streamList) {
          if (isChartableStream(stream.type) && !isSmoothVariantToHide(stream.type, streamList.map((s) => s.type))) {
            allStreamTypes.add(stream.type)
          }
        }
      }
      if (allStreamTypes.has('Heart Rate')) {
        selectedStreamTypes = new Set(['Heart Rate'])
      } else if (allStreamTypes.size > 0) {
        selectedStreamTypes = new Set([Array.from(allStreamTypes)[0]])
      }
    }
  }

  // Get all unique stream types across all events, but only include streams where at least 2 devices have data
  const allStreamTypes = $derived.by(() => {
    const streamCounts = new Map<string, number>()
    
    // Count how many devices have each stream type
    for (const streamList of Object.values(streamsByEventId)) {
      const seenTypes = new Set<string>()
      for (const stream of streamList) {
        if (isChartableStream(stream.type) && !isSmoothVariantToHide(stream.type, streamList.map((s) => s.type))) {
          // Only count each stream type once per device
          if (!seenTypes.has(stream.type)) {
            seenTypes.add(stream.type)
            // Only count if stream has data
            if (stream.data && stream.data.length > 0) {
              streamCounts.set(stream.type, (streamCounts.get(stream.type) || 0) + 1)
            }
          }
        }
      }
    }
    
    // Filter to only include stream types where at least 2 devices have data
    const filteredTypes = Array.from(streamCounts.entries())
      .filter(([_, count]) => count >= 2)
      .map(([type, _]) => type)
      .sort()
    
    return filteredTypes
  })

  // Get all unique stat types across all events, but only include stats where at least 2 devices have data
  const allStatTypes = $derived.by(() => {
    const statCounts = new Map<string, number>()
    
    // Count how many devices have each stat
    for (const eventDetail of events) {
      const activityId = selectedActivities[eventDetail.event.id]
      if (!activityId) continue
      const activity = eventDetail.activities.find((a) => a.id === activityId)
      if (activity?.stats) {
        Object.keys(activity.stats).forEach((key) => {
          const value = activity.stats[key]
          // Only count if the value is not null/undefined and is meaningful
          if (value != null && value !== '' && value !== 'N/A') {
            statCounts.set(key, (statCounts.get(key) || 0) + 1)
          }
        })
      }
    }
    
    // Filter to only include stats where at least 2 devices have data
    // Also deduplicate by (metric + aggregation) key, keeping only preferred variants
    // This filters out unit-specific Maximum/Minimum Speed variants (keeps only base versions)
    
    // Sort entries: base versions (no unit variant) first, then preferred unit variants, then others
    const entriesWithPreference = Array.from(statCounts.entries())
      .map(([statType, count]) => {
        if (count < 2) return null
        const parsed = parseStat(statType)
        const key = metricAggregationKeyNormalized(parsed) // case-insensitive so "Average Pace" and "Average pace in ..." collapse
        const preferred = keepStatByPreferredUnit(parsed)
        const isBaseVersion = parsed.unitVariant === null
        return { statType, count, key, preferred, isBaseVersion }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .sort((a, b) => {
        // Base versions (no unit variant) always come first
        if (a.isBaseVersion && !b.isBaseVersion) return -1
        if (!a.isBaseVersion && b.isBaseVersion) return 1
        // Then preferred variants
        return (b.preferred ? 1 : 0) - (a.preferred ? 1 : 0)
      })
    
    const byKey = new Map<string, string>()
    for (const entry of entriesWithPreference) {
      if (!byKey.has(entry.key)) {
        byKey.set(entry.key, entry.statType)
      }
    }
    
    const filteredTypes = Array.from(byKey.values()).sort()
    return filteredTypes
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

  // Handle activity change for an event
  async function handleActivityChange(eventId: string, activityId: string) {
    selectedActivities = { ...selectedActivities, [eventId]: activityId }
    await loadStreams()
  }

  // Generate auto name for comparison
  function generateComparisonName(): string {
    if (events.length === 2) {
      const device1 = (() => {
        const eventId = events[0].event.id
        const activityId = selectedActivities[eventId]
        const activity = events[0].activities.find((a) => a.id === activityId)
        return activity ? getActivityDeviceName(activity) : null
      })()
      const device2 = (() => {
        const eventId = events[1].event.id
        const activityId = selectedActivities[eventId]
        const activity = events[1].activities.find((a) => a.id === activityId)
        return activity ? getActivityDeviceName(activity) : null
      })()
      return `${device1 || events[0].event.name || 'Event 1'} vs ${device2 || events[1].event.name || 'Event 2'}`
    }
    return `${events.length} Events Comparison`
  }

  // Save comparison
  async function handleSave() {
    if (!saveName.trim()) {
      saveName = generateComparisonName()
      return
    }

    isSaving = true
    try {
      const settings: ComparisonSettings = {
        selectedStreams: Array.from(selectedStreamTypes),
        xAxisMode,
        selectedActivities: { ...selectedActivities },
      }

      const saved = await createComparison(saveName.trim(), eventIds, settings)
      savedComparison = saved
      showSaveDialog = false
      saveName = ''

      // Update URL to saved comparison ID
      replace(`/compare/${saved.id}`)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save comparison'
    } finally {
      isSaving = false
    }
  }

  // Delete comparison
  async function handleDelete() {
    if (!savedComparison) return

    isDeleting = true
    try {
      await deleteComparison(savedComparison.id)
      push('/comparisons')
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete comparison'
      isDeleting = false
    }
  }

  // Initialize: load saved comparison first, then events
  // Only depend on comparisonId to prevent infinite loops - don't depend on eventIdsFromQueryState
  $effect(() => {
    const id = comparisonId
    
    // For new comparisons, check eventIdsFromQueryState (but don't make it a dependency)
    if (id === 'new') {
      savedComparison = null
      loadedComparisonId = null
      
      // Get current query IDs without making it a reactive dependency
      const queryIds = eventIdsFromQueryState
      const ids = queryIds.filter((id) => id.trim().length > 0)
      
      // Early return if no IDs
      if (ids.length < 2) {
        if (!loading) {
          loading = false
          error = 'At least 2 events are required for comparison'
        }
        return
      }
      
      const idsStr = ids.slice().sort().join(',')
      
      // Only load if we haven't attempted to load these IDs yet
      if (idsStr !== lastLoadAttempt && !loading) {
        lastLoadAttempt = idsStr
        loadEvents()
      }
      return
    }
    
    // For existing comparisons, load saved comparison first
    // Only load if comparison ID changed
    if (loadedComparisonId !== id && !loading) {
      // Clear any stale error from the 'new' path (e.g. after save + replace, query empty before id updated)
      error = null
      loadSavedComparison().then(() => {
        // After loading saved comparison, check eventIds (which may come from saved comparison)
        const ids = savedComparison?.eventIds ?? []
        const idsStr = ids.slice().sort().join(',')
        
        if (ids.length >= 2 && idsStr !== lastLoadAttempt) {
          lastLoadAttempt = idsStr
          loadEvents()
        } else if (ids.length < 2) {
          loading = false
          error = 'At least 2 events are required for comparison'
        }
      })
    }
  })
  
  // Separate effect to handle eventIdsFromQueryState changes for new comparisons
  $effect(() => {
    // Only run for new comparisons
    if (comparisonId !== 'new') return
    
    // Access eventIdsFromQueryState to make it a dependency
    const queryIds = eventIdsFromQueryState
    const ids = queryIds.filter((id) => id.trim().length > 0)
    
    if (ids.length < 2) return
    
    const idsStr = ids.slice().sort().join(',')
    
    // Only trigger load if IDs changed and we haven't attempted to load them
    if (idsStr !== lastLoadAttempt && !loading) {
      lastLoadAttempt = idsStr
      loadEvents()
    }
  })

  // Routes for the comparison map: one per event with location streams, colored by EVENT_COLORS
  const comparisonRoutes = $derived.by(() => {
    const result: Array<{ label: string; color: string; streams: StreamData[] }> = []
    for (let i = 0; i < events.length; i++) {
      const eventDetail = events[i]
      const eventId = eventDetail.event.id
      const streams = streamsByEventId[eventId]
      if (!streams || !hasLocationStreams(streams)) continue
      const activityId = selectedActivities[eventId]
      const activity = eventDetail.activities.find((a) => a.id === activityId)
      const deviceName = activity ? getActivityDeviceName(activity) : null
      result.push({
        label: deviceName || eventDetail.event.name || `Event ${i + 1}`,
        color: EVENT_COLORS[i % EVENT_COLORS.length],
        streams,
      })
    }
    return result
  })

  const locationAvailable = $derived(comparisonRoutes.length > 0)

  // Get comparison entries for a stream type
  function getComparisonEntries(streamType: string) {
    const entries = []
    for (let i = 0; i < events.length; i++) {
      const eventDetail = events[i]
      const eventId = eventDetail.event.id
      const activityId = selectedActivities[eventId]
      if (!activityId) continue

      const activity = eventDetail.activities.find((a) => a.id === activityId)
      if (!activity) continue

      const stream = streamsByEventId[eventId]?.find((s) => s.type === streamType)
      if (!stream || !stream.data || stream.data.length === 0) continue

      const activityStartDate = activity.startDate ?? eventDetail.event.startDate ?? Date.now()
      // Use distinct colors from EVENT_COLORS for all events (not stream config color)
      const color = EVENT_COLORS[i % EVENT_COLORS.length]

      const deviceName = getActivityDeviceName(activity)
      entries.push({
        eventName: deviceName || eventDetail.event.name || `Event ${i + 1}`,
        color,
        data: stream,
        activityStartDate,
      })
    }
    return entries
  }

  // Calculate delta for stats (when exactly 2 events)
  function calculateDelta(value1: unknown, value2: unknown): { absolute: number; percent: number } | null {
    const num1 = typeof value1 === 'number' ? value1 : null
    const num2 = typeof value2 === 'number' ? value2 : null
    if (num1 == null || num2 == null) return null

    const absolute = num2 - num1
    const percent = num1 !== 0 ? (absolute / num1) * 100 : (num2 !== 0 ? 100 : 0)
    return { absolute, percent }
  }
</script>

<section class="mx-auto w-[85%] max-w-screen-2xl py-6">
  <button
    type="button"
    class="mb-4 rounded border border-border px-3 py-1.5 text-base text-text-secondary hover:bg-card-hover hover:text-text-primary"
    onclick={() => push('/')}
  >
    ← Back to Dashboard
  </button>

  {#if loading || loadingComparison}
    <div class="flex justify-center py-12">
      <LoadingSpinner />
    </div>
  {:else if error}
    <div class="rounded-md border border-danger/20 bg-danger/10 p-4 backdrop-blur">
      <p class="text-sm font-medium text-danger">{error}</p>
    </div>
  {:else if events.length < 2}
    <div class="rounded-md border border-border bg-card p-4 backdrop-blur">
      <p class="text-sm font-medium text-text-primary">At least 2 events are required for comparison</p>
    </div>
  {:else}
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-text-primary">
          {savedComparison?.name || 'Event Comparison'}
        </h1>
        {#if savedComparison}
          <p class="mt-1 text-sm text-text-secondary">
            Saved {savedComparison.createdAt ? new Date(savedComparison.createdAt).toLocaleDateString() : ''}
          </p>
        {/if}
      </div>
      <div class="flex gap-2">
        {#if savedComparison}
          <button
            type="button"
            class="rounded border border-danger/30 bg-card px-4 py-2 text-sm font-medium text-danger shadow-sm hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger disabled:opacity-50"
            onclick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        {:else}
          <button
            type="button"
            class="rounded border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent"
            onclick={() => {
              saveName = generateComparisonName()
              showSaveDialog = true
            }}
          >
            Save Comparison
          </button>
        {/if}
      </div>
    </div>

    <!-- Activity Selectors (if any event has multiple activities) -->
    {#if events.some((e) => e.activities.length > 1)}
      <div class="mb-6 space-y-4 rounded-lg border border-border bg-card p-4">
        <h2 class="text-lg font-semibold text-text-primary">Select Activities</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          {#each events as eventDetail, i (eventDetail.event.id)}
            {@const eventId = eventDetail.event.id}
            {@const currentActivityId = selectedActivities[eventId]}
            {#if eventDetail.activities.length > 1}
              <div>
                <label class="mb-1 block text-sm font-medium text-text-secondary">
                  {(() => {
                    const activityId = selectedActivities[eventId]
                    const activity = eventDetail.activities.find((a) => a.id === activityId)
                    return activity ? getActivityDeviceName(activity) : (eventDetail.event.name || `Event ${i + 1}`)
                  })()}
                </label>
                <select
                  class="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                  value={currentActivityId}
                  onchange={(e) => handleActivityChange(eventId, (e.target as HTMLSelectElement).value)}
                >
                  {#each eventDetail.activities as activity (activity.id)}
                    <option value={activity.id}>
                      {activity.name || activity.type || `Activity ${eventDetail.activities.indexOf(activity) + 1}`}
                    </option>
                  {/each}
                </select>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <ComparisonStatsTable
      events={events}
      selectedActivities={selectedActivities}
      allStatTypes={allStatTypes}
      eventColors={EVENT_COLORS}
      getActivityDeviceName={getActivityDeviceName}
      calculateDelta={calculateDelta}
    />

    <!-- Comparison map: all devices' routes with EVENT_COLORS -->
    {#if locationAvailable}
      <div class="mb-6 overflow-hidden rounded-xl border border-border shadow-sm">
        <RouteMap routes={comparisonRoutes} />
      </div>
    {/if}

    <!-- Charts Section -->
    <div class="mb-6">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-xl font-semibold text-text-primary">Stream Comparison</h2>
        <div class="flex items-center gap-4">
          <!-- X-axis Mode Toggle -->
          <div class="flex items-center gap-2">
            <span class="text-sm text-text-secondary">X-axis:</span>
            <button
              type="button"
              class="rounded border px-3 py-1 text-sm transition-colors {xAxisMode === 'elapsed'
                ? 'border-border bg-card text-text-primary'
                : 'border-border bg-transparent text-text-secondary hover:bg-card-hover'}"
              onclick={() => (xAxisMode = 'elapsed')}
            >
              Elapsed
            </button>
            <button
              type="button"
              class="rounded border px-3 py-1 text-sm transition-colors {xAxisMode === 'wall-clock'
                ? 'border-border bg-card text-text-primary'
                : 'border-border bg-transparent text-text-secondary hover:bg-card-hover'}"
              onclick={() => (xAxisMode = 'wall-clock')}
            >
              Wall Clock
            </button>
          </div>
        </div>
      </div>

      <!-- Stream Type Selection Pills -->
      <div class="mb-4 flex flex-wrap gap-2">
        {#each allStreamTypes as streamType (streamType)}
          {@const config = getStreamConfig(streamType)}
          {@const isSelected = selectedStreamTypes.has(streamType)}
          <button
            type="button"
            class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors {isSelected
              ? 'text-text-primary'
              : 'border-border bg-transparent text-text-muted hover:bg-card-hover'}"
            style={isSelected ? `background-color: ${config.color}26; border-color: ${config.color}66` : ''}
            onclick={() => toggleStream(streamType)}
          >
            <span
              class="h-2 w-2 rounded-full {isSelected ? '' : 'opacity-40'}"
              style="background-color: {config.color};"
            ></span>
            <span>{config.label}</span>
          </button>
        {/each}
      </div>

      <!-- Charts -->
      {#if selectedStreamTypes.size > 0}
        <div class="space-y-6">
          {#each Array.from(selectedStreamTypes) as streamType (streamType)}
            {@const entries = getComparisonEntries(streamType)}
            {#if entries.length > 0}
              <div class="overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm backdrop-blur-lg">
                <h3 class="mb-4 text-lg font-semibold text-text-primary">{getStreamConfig(streamType).label}</h3>
                <ComparisonChart {streamType} {entries} {xAxisMode} />
              </div>
            {/if}
          {/each}
        </div>
      {:else}
        <div class="flex h-32 items-center justify-center rounded-lg border border-border bg-card">
          <p class="text-sm text-text-secondary">Select stream types above to view charts</p>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Save Dialog -->
  {#if showSaveDialog}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onclick={() => (showSaveDialog = false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        class="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl backdrop-blur-xl"
        onclick={(e) => e.stopPropagation()}
      >
        <h2 class="mb-4 text-lg font-semibold text-text-primary">Save Comparison</h2>
        <div class="mb-6">
          <label class="mb-2 block text-sm font-medium text-text-secondary">Name</label>
          <input
            type="text"
            class="w-full rounded border border-border bg-card px-3 py-2 text-text-primary"
            bind:value={saveName}
            placeholder="Enter comparison name"
            onkeydown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') showSaveDialog = false
            }}
          />
        </div>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover"
            onclick={() => (showSaveDialog = false)}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md border-0 bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-hover disabled:opacity-50"
            onclick={handleSave}
            disabled={isSaving || !saveName.trim()}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</section>
