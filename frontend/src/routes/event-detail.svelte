<script lang="ts">
  interface Props {
    params?: { id?: string };
    query?: { back?: string };
  }
  let { params = {}, query = {} }: Props = $props();

  import { push } from 'svelte-spa-router';
  import {
    formatDateWithOriginalTimezone,
    getActivityDeviceName,
    parseHashParam,
  } from '../lib/utils';
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte';
  import RouteMap from '../lib/components/RouteMap.svelte';
  import SearchableSelect from '../lib/components/SearchableSelect.svelte';
  import StatCard from '../lib/components/StatCard.svelte';
  import EventDetailMoreStats from '../lib/components/event-detail/EventDetailMoreStats.svelte';
  import EventDetailStreamCharts from '../lib/components/event-detail/EventDetailStreamCharts.svelte';
  import PowerCurveChart from '../lib/components/event-detail/PowerCurveChart.svelte';
  import ExportButton from '../lib/components/ExportButton.svelte';
  import EventExportDropdown from '../lib/components/EventExportDropdown.svelte';
  import { exportAsPng } from '../lib/utils/export-image';
  import { buildFolderHash, foldersState } from '../lib/stores/folders.svelte';
  import { metaState, ensureActivityTypes, ensureDevices } from '../lib/stores/meta-store.svelte';
  import { FOLDER_SELECTION_UNFILED } from '../lib/types/event';
  import CompareCandidatesFlow from '../lib/components/workouts/CompareCandidatesFlow.svelte';
  import type { ActivityRow } from '../lib/types';
  import {
    state as eventDetailLoaderState,
    loadEventDetail,
    setSelectedActivityId,
    toggleStream,
    commitActivityType as commitActivityTypeLoader,
    commitDevice as commitDeviceLoader,
  } from '../lib/stores/event-detail-loader.svelte';

  const id = $derived(params?.id ?? '');

  // Centralized data + stream loading for this route.
  $effect(() => {
    void loadEventDetail(id);
  });

  let compareCandidatesFlow: CompareCandidatesFlow | undefined = $state(undefined);

  const eventActivityRows = $derived.by((): ActivityRow[] => {
    if (!eventDetail) return [];
    return [{ event: eventDetail.event, activity: eventDetail.activities[0] }];
  });

  let backFolderId = $state<string | null>(null);
  let powerCurveSectionEl = $state<HTMLElement | null>(null);

  $effect(() => {
    backFolderId = query?.back?.trim() || parseHashParam(window.location.hash, 'back');
  });

  // If back is a path (e.g. /compare/123), use it directly; otherwise treat as folder id
  const backPath = $derived(
    !backFolderId
      ? '/'
      : backFolderId.startsWith('/')
        ? backFolderId
        : buildFolderHash(backFolderId)
  );

  const eventDetail = $derived(eventDetailLoaderState.eventDetail);
  const loading = $derived(eventDetailLoaderState.loading);
  const error = $derived(eventDetailLoaderState.error);
  const streams = $derived(eventDetailLoaderState.streams);
  const streamsLoading = $derived(eventDetailLoaderState.streamsLoading);
  const streamsError = $derived(eventDetailLoaderState.streamsError);
  const relatedComparisons = $derived(eventDetailLoaderState.relatedComparisons);
  const relatedComparisonsLoading = $derived(eventDetailLoaderState.relatedComparisonsLoading);
  const relatedComparisonsError = $derived(eventDetailLoaderState.relatedComparisonsError);
  const event = $derived(eventDetailLoaderState.event);

  const eventFolder = $derived.by(() => {
    if (!event) return undefined;
    if (!event.folderId) return null; // unfiled
    return foldersState.folders.find((f) => f.id === event.folderId) ?? null;
  });

  const mainActivityType = $derived(eventDetailLoaderState.mainActivityType);
  const activityTypeIcon = $derived(eventDetailLoaderState.activityTypeIcon);
  const keyMetrics = $derived(eventDetailLoaderState.keyMetrics);
  const groupedStatsSections = $derived(eventDetailLoaderState.groupedStatsSections);
  const keyMetricTypes = $derived(eventDetailLoaderState.keyMetricTypes);
  const hasMoreStats = $derived(eventDetailLoaderState.hasMoreStats);
  let moreStatsOpen = $state(false);

  // Inline edit: activity type and device
  type EditField = 'activityType' | 'device' | null;
  let editField = $state<EditField>(null);
  const activityTypesCache = $derived(metaState.activityTypes);
  const devicesCache = $derived(metaState.devices);
  let optionsLoading = $state(false);
  let saveError = $state<string | null>(null);
  const saving = $derived(eventDetailLoaderState.saving);

  // Activity + stream selection comes from the loader store.
  const selectedActivityId = $derived(eventDetailLoaderState.selectedActivityId);
  const activities = $derived(eventDetailLoaderState.activities);
  const selectedActivity = $derived(eventDetailLoaderState.selectedActivity);
  const activityStartDate = $derived(eventDetailLoaderState.activityStartDate);

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
    return formatDateWithOriginalTimezone(ev.startDate, ev.startTimezone);
  });

  async function openActivityTypeEditor() {
    saveError = null;
    if (activityTypesCache.length === 0) {
      optionsLoading = true;
      try {
        await ensureActivityTypes();
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
        await ensureDevices();
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
    if (!id) return;
    saveError = null;
    try {
      await commitActivityTypeLoader(newType);
      editField = null;
    } catch (e) {
      saveError = e instanceof Error ? e.message : 'Failed to update activity type';
    }
  }

  async function commitDevice(newDevice: string) {
    if (!id) return;
    saveError = null;
    try {
      await commitDeviceLoader(newDevice);
      editField = null;
    } catch (e) {
      saveError = e instanceof Error ? e.message : 'Failed to update device';
    }
  }

  const chartableStreams = $derived(eventDetailLoaderState.chartableStreams);
  const chartableStreamsOrdered = $derived(eventDetailLoaderState.chartableStreamsOrdered);
  const visibleStreams = $derived(eventDetailLoaderState.visibleStreams);
  const selectedStreamTypes = $derived(eventDetailLoaderState.selectedStreamTypes);
  const locationAvailable = $derived(eventDetailLoaderState.locationAvailable);
  const powerCurveSeries = $derived(eventDetailLoaderState.powerCurveSeries);
  const powerCurveMaxDuration = $derived(eventDetailLoaderState.powerCurveMaxDuration);

  // View mode: 'stacked' or 'overlay'
  let viewMode = $state<'stacked' | 'overlay'>('stacked');
</script>

<section class="mx-auto w-full max-w-screen-2xl px-4 sm:px-6 py-6">
  <div class="mb-4 flex items-center gap-4">
    <button
      type="button"
      class="rounded border border-border px-3 py-1.5 text-base text-text-secondary hover:bg-card-hover hover:text-text-primary shrink-0"
      onclick={() => push(backPath)}
    >
      ← Back to Workouts
    </button>
    <div class="flex-1 flex justify-center">
      {#if eventFolder}
        <a
          href={buildFolderHash(eventFolder.id)}
          class="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <span
            class="material-icons text-base"
            style="color: {eventFolder.color};"
            aria-hidden="true">folder</span
          >
          <span>{eventFolder.name}</span>
        </a>
      {:else if eventFolder === null}
        <a
          href={buildFolderHash(FOLDER_SELECTION_UNFILED)}
          class="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <span class="material-icons text-base" aria-hidden="true">folder_off</span>
          <span>Unfiled</span>
        </a>
      {/if}
    </div>
    {#if event}
      <EventExportDropdown
        eventId={id}
        eventName={event.name ?? 'event'}
        hasGps={locationAvailable}
      />
    {:else}
      <div class="shrink-0"></div>
    {/if}
  </div>

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
              {#if event.importProvider === 'strava' && event.importExternalId}
                <a
                  href="https://www.strava.com/activities/{encodeURIComponent(
                    event.importExternalId
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="shrink-0 text-sm font-semibold text-[#FC5200] underline"
                >
                  View on Strava
                </a>
              {/if}
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

    <!-- Related Comparisons Section -->
    <div class="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div class="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 class="text-base font-semibold text-text-primary">
          In comparisons ({relatedComparisons.length})
        </h3>
        <button
          type="button"
          class="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
          onclick={() => compareCandidatesFlow?.openForEvent(id)}
        >
          <span class="material-icons text-[1.15em] leading-none" aria-hidden="true">compare</span>
          Compare with another event
        </button>
      </div>
      {#if relatedComparisonsLoading}
        <div class="p-4">
          <div class="flex items-center gap-2 text-text-secondary">
            <span class="material-icons animate-spin text-base">refresh</span>
            <span class="text-sm">Loading related comparisons...</span>
          </div>
        </div>
      {:else if relatedComparisonsError}
        <div class="p-4">
          <div class="flex items-center gap-2 text-danger">
            <span class="material-icons text-base">error_outline</span>
            <span class="text-sm">{relatedComparisonsError}</span>
          </div>
        </div>
      {:else if relatedComparisons.length > 0}
        <div class="divide-y divide-border">
          {#each relatedComparisons as comparison (comparison.id)}
            <div class="flex items-center justify-between px-6 py-3 hover:bg-surface/50">
              <span class="text-text-primary">{comparison.name}</span>
              <button
                type="button"
                class="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                onclick={() => push(`/compare/${comparison.id}`)}
              >
                View
                <span class="material-icons text-base">arrow_forward</span>
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="px-6 py-4 text-sm text-text-secondary">Not in any comparisons yet.</div>
      {/if}
    </div>

    {#if locationAvailable && !streamsLoading}
      <div class="mt-6 overflow-hidden rounded-xl border border-border shadow-sm">
        <RouteMap {streams} />
      </div>
    {/if}

    {#if powerCurveSeries.length > 0}
      <div
        bind:this={powerCurveSectionEl}
        class="mt-6 overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm backdrop-blur-lg"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-base font-semibold text-text-primary">Power Curve</h3>
          {#if powerCurveSectionEl}
            <ExportButton
              onExport={() => exportAsPng(powerCurveSectionEl!, 'power-curve')}
              title="Export chart as PNG"
            />
          {/if}
        </div>
        <PowerCurveChart series={powerCurveSeries} maxDuration={powerCurveMaxDuration} />
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
      onSelectActivity={(activityId) => setSelectedActivityId(activityId)}
    />
  {:else}
    <p class="text-text-secondary">Event not found.</p>
  {/if}
</section>

<CompareCandidatesFlow
  bind:this={compareCandidatesFlow}
  activityRows={eventActivityRows}
  onCompare={(eventIds, suggestedFolderId) => {
    const params = new URLSearchParams();
    params.set('events', eventIds.join(','));
    if (suggestedFolderId) params.set('folder', suggestedFolderId);
    push(`/compare/new?${params.toString()}`);
  }}
/>
