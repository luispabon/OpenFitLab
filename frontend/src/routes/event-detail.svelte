<script lang="ts">
  interface Props {
    params?: { id?: string };
  }
  let { params = {} }: Props = $props();

  import { push } from 'svelte-spa-router';
  import { getEvent, getStreams, getActivityTypes, getDevices, updateActivity } from '../lib/api';
  import type { EventDetail as EventDetailType, StreamData } from '../lib/types';
  import {
    formatDateWithTime,
    getActivityIcon,
    isChartableStream,
    isSmoothVariantToHide,
    hasLocationStreams,
    getActivityDeviceName,
  } from '../lib/utils';
  import { getStatUnit } from '../lib/utils/stat-icons';
  import { formatStatValue } from '../lib/utils/stat-formatting';
  import { selectKeyMetrics, getGroupedDeduplicatedStats } from '../lib/utils/stat-categories';
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte';
  import RouteMap from '../lib/components/RouteMap.svelte';
  import SearchableSelect from '../lib/components/SearchableSelect.svelte';
  import StatCard from '../lib/components/StatCard.svelte';
  import EventDetailMoreStats from '../lib/components/event-detail/EventDetailMoreStats.svelte';
  import EventDetailStreamCharts from '../lib/components/event-detail/EventDetailStreamCharts.svelte';

  const id = $derived(params?.id ?? '');

  let eventDetail = $state<EventDetailType | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let streams = $state<StreamData[]>([]);
  let streamsLoading = $state(false);
  let streamsError = $state<string | null>(null);
  const event = $derived(eventDetail?.event ?? null);

  const mainActivityType = $derived.by(() => {
    const ev = event;
    if (!ev) return '';
    const activities = eventDetail?.activities ?? [];
    const fromActivities = activities[0]?.type;
    if (fromActivities) return fromActivities;
    const activityTypes = ev.stats?.['Activity Types'];
    if (Array.isArray(activityTypes) && activityTypes.length > 0) return String(activityTypes[0]);
    if (typeof activityTypes === 'string') return activityTypes;
    return '';
  });

  const activityTypeIcon = $derived(getActivityIcon(mainActivityType));

  /** Key metrics for this activity type (4–6 stats), used in the header bar. */
  const keyMetrics = $derived.by(() => {
    const ev = event;
    if (!ev?.stats) return [];
    return selectKeyMetrics(ev.stats, mainActivityType);
  });

  const statEntries = $derived.by(() => {
    const ev = event;
    if (!ev?.stats) return [];
    return Object.entries(ev.stats).map(([statType, raw]) => ({
      statType,
      value: formatStatValue(raw, statType),
      unit: getStatUnit(statType),
    }));
  });

  const groupedStatsSections = $derived(getGroupedDeduplicatedStats(statEntries));

  const keyMetricTypes = $derived(new Set(keyMetrics.map((e) => e.statType)));

  /** Whether there are any grouped stats to show (excluding key metrics). */
  const hasMoreStats = $derived(
    groupedStatsSections.some((section) =>
      section.entries.some((e) => !keyMetricTypes.has(e.statType))
    )
  );
  let moreStatsOpen = $state(false);

  // Inline edit: activity type and device
  type EditField = 'activityType' | 'device' | null;
  let editField = $state<EditField>(null);
  let activityTypesCache = $state<string[]>([]);
  let devicesCache = $state<string[]>([]);
  let optionsLoading = $state(false);
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  // Selected activity (defaults to first)
  let selectedActivityId = $state<string | null>(null);

  // Activities list
  const activities = $derived(eventDetail?.activities ?? []);

  // Selected activity (or first if none selected)
  const selectedActivity = $derived.by(() => {
    if (selectedActivityId) {
      return activities.find((a) => a.id === selectedActivityId) ?? activities[0] ?? null;
    }
    return activities[0] ?? null;
  });

  // Initialize selected activity when activities load
  $effect(() => {
    if (activities.length > 0 && !selectedActivityId) {
      selectedActivityId = activities[0].id;
    }
  });

  const activityStartDate = $derived(selectedActivity?.startDate ?? event?.startDate ?? Date.now());

  // Device name from selected activity (or first activity)
  const deviceName = $derived.by(() => {
    const act = selectedActivity;
    if (!act) return '—';
    return getActivityDeviceName(act);
  });

  // Formatted date string: "Feb 19, 2026 at 08:39" (24-hour format)
  const formattedDateString = $derived.by(() => {
    const ev = event;
    if (!ev?.startDate) return '';
    return formatDateWithTime(ev.startDate);
  });

  async function openActivityTypeEditor() {
    saveError = null;
    if (activityTypesCache.length === 0) {
      optionsLoading = true;
      try {
        activityTypesCache = await getActivityTypes();
      } finally {
        optionsLoading = false;
      }
    }
    editField = 'activityType';
  }

  async function openDeviceEditor() {
    saveError = null;
    if (devicesCache.length === 0) {
      optionsLoading = true;
      try {
        devicesCache = await getDevices();
      } finally {
        optionsLoading = false;
      }
    }
    editField = 'device';
  }

  function closeEditor() {
    editField = null;
    saveError = null;
  }

  async function commitActivityType(newType: string) {
    const ev = event;
    const firstActivity = activities[0];
    if (!id || !ev || !firstActivity) return;
    saving = true;
    saveError = null;
    try {
      const updated = await updateActivity(id, firstActivity.id, { type: newType });
      if (eventDetail) {
        const nextActivities = eventDetail.activities.map((a) =>
          a.id === updated.id ? updated : a
        );
        const types = [
          ...new Set(nextActivities.map((a) => a.type).filter((t): t is string => Boolean(t))),
        ].sort();
        eventDetail = {
          ...eventDetail,
          activities: nextActivities,
          event: {
            ...eventDetail.event,
            stats: {
              ...eventDetail.event.stats,
              'Activity Types': types as unknown as
                | string
                | number
                | number[]
                | Record<string, unknown>,
            },
          },
        };
      }
      editField = null;
    } catch (e) {
      saveError = e instanceof Error ? e.message : 'Failed to update activity type';
    } finally {
      saving = false;
    }
  }

  async function commitDevice(newDevice: string) {
    const act = selectedActivity;
    if (!id || !act) return;
    saving = true;
    saveError = null;
    try {
      const updated = await updateActivity(id, act.id, { deviceName: newDevice });
      if (eventDetail) {
        eventDetail = {
          ...eventDetail,
          activities: eventDetail.activities.map((a) => (a.id === updated.id ? updated : a)),
        };
      }
      editField = null;
    } catch (e) {
      saveError = e instanceof Error ? e.message : 'Failed to update device';
    } finally {
      saving = false;
    }
  }

  // Filter to chartable streams only; hide "X Smooth" when "X" is also present
  const allStreamTypes = $derived(streams.map((s) => s.type));
  const chartableStreams = $derived(
    streams.filter(
      (s) =>
        isChartableStream(s.type) &&
        s.data &&
        s.data.length > 0 &&
        !isSmoothVariantToHide(s.type, allStreamTypes)
    )
  );

  // Heart Rate first, then rest in original order (for toggles and chart order)
  const chartableStreamsOrdered = $derived.by(() => {
    const list = [...chartableStreams];
    const hr = list.find((s) => s.type === 'Heart Rate');
    if (!hr) return list;
    return [hr, ...list.filter((s) => s.type !== 'Heart Rate')];
  });

  // Selected streams for visibility toggle (only Heart Rate selected by default)
  let selectedStreamTypes = $state<Set<string>>(new Set());
  let hasInitializedSelection = $state(false);

  // View mode: 'stacked' or 'overlay'
  let viewMode = $state<'stacked' | 'overlay'>('stacked');

  const lastActivityIdRef = { current: null as string | null };

  // When activity changes, allow re-initializing selection for the new activity's streams
  $effect(() => {
    const aid = selectedActivity?.id ?? null;
    if (aid !== lastActivityIdRef.current) {
      lastActivityIdRef.current = aid;
      hasInitializedSelection = false;
    }
  });

  // Initialize selected streams when chartableStreams load: only Heart Rate by default
  $effect(() => {
    if (chartableStreams.length > 0 && !hasInitializedSelection) {
      hasInitializedSelection = true;
      const hasHeartRate = chartableStreams.some((s) => s.type === 'Heart Rate');
      selectedStreamTypes = hasHeartRate
        ? new Set(['Heart Rate'])
        : new Set([chartableStreams[0].type]);
    }
  });

  // Toggle stream visibility
  function toggleStream(type: string) {
    const newSet = new Set(selectedStreamTypes);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    selectedStreamTypes = newSet;
  }

  // Toggle view mode
  function _toggleViewMode() {
    viewMode = viewMode === 'stacked' ? 'overlay' : 'stacked';
  }

  const locationAvailable = $derived(hasLocationStreams(streams));

  // Filter to only selected streams (order: Heart Rate first, then rest)
  const visibleStreams = $derived(
    chartableStreamsOrdered.filter((s) => selectedStreamTypes.has(s.type))
  );

  async function loadEvent() {
    if (!id) {
      eventDetail = null;
      loading = false;
      return;
    }
    loading = true;
    error = null;
    try {
      eventDetail = await getEvent(id);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Event not found';
      eventDetail = null;
    } finally {
      loading = false;
    }
  }

  async function loadStreams() {
    if (!id || !selectedActivity?.id) {
      streams = [];
      return;
    }

    streamsLoading = true;
    streamsError = null;
    try {
      const loadedStreams = await getStreams(id, selectedActivity.id);
      streams = loadedStreams;
    } catch (e) {
      streamsError = e instanceof Error ? e.message : 'Failed to load streams';
      streams = [];
    } finally {
      streamsLoading = false;
    }
  }

  // Load event when ID changes
  $effect(() => {
    if (id) loadEvent();
  });

  // Load streams when event and selected activity are available (single effect for initial load and activity switch)
  $effect(() => {
    if (eventDetail && selectedActivity?.id && !loading) {
      loadStreams();
    }
  });
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
    <div class="overflow-hidden rounded-xl border border-border bg-card shadow-sm backdrop-blur-lg">
      <!-- Header -->
      <div
        class="flex flex-wrap items-center gap-4 border-b border-border px-6 py-5 sm:flex-nowrap"
      >
        <div class="flex flex-1 items-center gap-4 min-w-0">
          <div
            class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-surface"
          >
            <span class="material-icons text-3xl text-text-primary">
              {activityTypeIcon}
            </span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center gap-1.5">
                {#if editField === 'activityType'}
                  <div class="min-w-[12rem]">
                    <SearchableSelect
                      options={activityTypesCache}
                      value={mainActivityType}
                      allowCustom={false}
                      placeholder="Activity type…"
                      oncommit={commitActivityType}
                      oncancel={closeEditor}
                    />
                  </div>
                {:else if activities.length > 0}
                  <button
                    type="button"
                    class="group inline-flex items-center gap-1 rounded px-0.5 py-0.5 text-left font-medium text-text-primary hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                    onclick={openActivityTypeEditor}
                    disabled={optionsLoading || saving}
                  >
                    <span>{mainActivityType || '—'}</span>
                    <span
                      class="material-icons text-base text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    >
                      edit
                    </span>
                  </button>
                {:else}
                  <span class="font-medium text-text-primary">{mainActivityType || '—'}</span>
                {/if}
                <span class="font-medium text-text-primary"> - {formattedDateString}</span>
              </div>
              <div class="flex items-center gap-1.5">
                {#if editField === 'device'}
                  <div class="min-w-[12rem]">
                    <SearchableSelect
                      options={devicesCache}
                      value={deviceName === '—' ? '' : deviceName}
                      allowCustom={true}
                      placeholder="Device…"
                      oncommit={commitDevice}
                      oncancel={closeEditor}
                    />
                  </div>
                {:else if selectedActivity}
                  <button
                    type="button"
                    class="group inline-flex items-center gap-1 rounded px-0.5 py-0.5 text-left text-text-secondary hover:bg-surface hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:opacity-60"
                    onclick={openDeviceEditor}
                    disabled={optionsLoading || saving}
                  >
                    <span>{deviceName}</span>
                    <span
                      class="material-icons text-base text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    >
                      edit
                    </span>
                  </button>
                {:else}
                  <span class="text-text-secondary">{deviceName}</span>
                {/if}
              </div>
              <span class="text-text-secondary truncate" title={event.name || undefined}>
                {event.name || '—'}
              </span>
            </div>
          </div>
        </div>
        <!-- Key metrics: stat cards in header -->
        {#if keyMetrics.length > 0}
          <div class="flex flex-shrink-0 flex-wrap items-stretch justify-end gap-3 sm:flex-nowrap">
            {#each keyMetrics as entry (entry.statType)}
              <StatCard statType={entry.statType} value={entry.value} unit={entry.unit} />
            {/each}
          </div>
        {/if}
      </div>

      {#if saveError}
        <div class="border-t border-border px-6 py-2 text-sm text-danger" role="alert">
          {saveError}
        </div>
      {/if}

      <EventDetailMoreStats
        {hasMoreStats}
        open={moreStatsOpen}
        groupedSections={groupedStatsSections}
        {keyMetricTypes}
        onToggle={() => (moreStatsOpen = !moreStatsOpen)}
      />
    </div>

    {#if locationAvailable && !streamsLoading}
      <div class="mt-6 overflow-hidden rounded-xl border border-border shadow-sm">
        <RouteMap {streams} />
      </div>
    {/if}

    <EventDetailStreamCharts
      {streamsLoading}
      {streamsError}
      {chartableStreams}
      {chartableStreamsOrdered}
      {selectedStreamTypes}
      {viewMode}
      {visibleStreams}
      {activityStartDate}
      {activities}
      {selectedActivityId}
      hasSelectedActivity={!!selectedActivity}
      onToggleStream={toggleStream}
      onViewModeStacked={() => (viewMode = 'stacked')}
      onViewModeOverlay={() => (viewMode = 'overlay')}
      onSelectActivity={(activityId) => (selectedActivityId = activityId)}
    />
  {:else}
    <p class="text-text-secondary">Event not found.</p>
  {/if}
</section>
