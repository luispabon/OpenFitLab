<script lang="ts">
  interface Props {
    params?: { id?: string };
    query?: { events?: string; folder?: string; back?: string };
  }
  let { params = {}, query = {} }: Props = $props();

  import { push, replace, location } from 'svelte-spa-router';
  import {
    createComparison,
    deleteComparison,
    updateComparisonName,
    updateComparisonSettings,
  } from '../lib/api';
  import type { StreamData, ComparisonSettings, Folder } from '../lib/types';
  import {
    isChartableStream,
    isSmoothVariantToHide,
    getStreamConfig,
    getActivityDeviceName,
    hasLocationStreams,
    parseHashParam,
  } from '../lib/utils';
  import { calculateDelta } from '../lib/utils/comparison-chart-data';
  import {
    state as loaderState,
    reload as loaderReload,
    loadStreams as loaderLoadStreams,
    setSelectedActivities,
    setSelectedStreamTypes,
    setXAxisMode,
    setComparison,
    setReferenceActivityId,
    toggleHiddenStat as loaderToggleHiddenStat,
    clearHiddenStats as loaderClearHiddenStats,
  } from '../lib/stores/comparison-loader.svelte';
  import { getComparisonStatTypes } from '../lib/utils/stat-categories';
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte';
  import ComparisonChartCard from '../lib/components/comparison/ComparisonChartCard.svelte';
  import ComparisonStatsTable from '../lib/components/comparison/ComparisonStatsTable.svelte';
  import StreamAnalysisSection from '../lib/components/comparison/StreamAnalysisSection.svelte';
  import RouteMap from '../lib/components/RouteMap.svelte';
  import PowerCurveChart from '../lib/components/event-detail/PowerCurveChart.svelte';
  import ExportButton from '../lib/components/ExportButton.svelte';
  import { exportAsPng } from '../lib/utils/export-image';
  import { foldersState, buildFolderHash } from '../lib/stores/folders.svelte';

  const comparisonId = $derived(params?.id ?? '');

  let powerCurveSectionEl = $state<HTMLElement | null>(null);

  const currentLocation = $derived($location);

  // Parse query parameters from URL hash
  let eventIdsFromQueryState = $state<string[]>([]);
  let folderIdFromQueryState = $state<string | null>(null);
  let backFolderFromQueryState = $state<string | null>(null);

  $effect(() => {
    const _loc = currentLocation;
    if (query?.events) {
      const ids = query.events
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);
      const idsStr = ids.slice().sort().join(',');
      const currentStr = eventIdsFromQueryState.slice().sort().join(',');
      if (idsStr !== currentStr) eventIdsFromQueryState = ids;
      const folderFromQuery = query?.folder?.trim() || null;
      if (folderFromQuery !== folderIdFromQueryState) folderIdFromQueryState = folderFromQuery;
      const backFromQuery = query?.back?.trim() || null;
      if (backFromQuery !== backFolderFromQueryState) backFolderFromQueryState = backFromQuery;
      return;
    }
    try {
      const hash = window.location.hash;
      const eventsRaw = parseHashParam(hash, 'events');
      const folderFromHash = parseHashParam(hash, 'folder');
      if (folderFromHash !== folderIdFromQueryState) folderIdFromQueryState = folderFromHash;
      const backFromHash = parseHashParam(hash, 'back');
      if (backFromHash !== backFolderFromQueryState) backFolderFromQueryState = backFromHash;
      if (eventsRaw) {
        const ids = eventsRaw
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0);
        const idsStr = ids.slice().sort().join(',');
        const currentStr = eventIdsFromQueryState.slice().sort().join(',');
        if (idsStr !== currentStr) eventIdsFromQueryState = ids;
      } else if (eventIdsFromQueryState.length > 0) {
        eventIdsFromQueryState = [];
      }
    } catch {
      if (eventIdsFromQueryState.length > 0) eventIdsFromQueryState = [];
    }
  });

  const eventIdsFromQuery = $derived(eventIdsFromQueryState);
  const folderIdForNewComparison = $derived(folderIdFromQueryState);

  // Trigger loader when comparisonId or (for 'new') eventIdsFromQueryState change.
  // Use reload() so we refetch when returning to this page (e.g. after editing event device name).
  $effect(() => {
    loaderReload(comparisonId, eventIdsFromQueryState);
  });

  // Also reload when user returns to this tab (visibility visible) to pick up external edits.
  $effect(() => {
    const id = comparisonId;
    const eventIds = eventIdsFromQueryState;
    const handler = () => {
      if (document.visibilityState === 'visible') {
        loaderReload(id, eventIds);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  });

  const EVENT_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899'];

  let showSaveDialog = $state(false);
  let saveName = $state('');
  let isSaving = $state(false);
  let isDeleting = $state(false);
  let saveError = $state<string | null>(null);
  let saveDialogNameInputEl = $state<HTMLInputElement | null>(null);
  let deleteError = $state<string | null>(null);

  let settingsSaveError = $state<string | null>(null);
  let settingsSaveErrorTimeout: ReturnType<typeof setTimeout> | null = null;

  function showSettingsError(message: string) {
    settingsSaveError = message;
    if (settingsSaveErrorTimeout) clearTimeout(settingsSaveErrorTimeout);
    settingsSaveErrorTimeout = setTimeout(() => {
      settingsSaveError = null;
      settingsSaveErrorTimeout = null;
    }, 5000);
  }

  $effect(() => {
    return () => {
      if (settingsSaveErrorTimeout) clearTimeout(settingsSaveErrorTimeout);
    };
  });

  // Focus the dialog's primary input when it opens.
  $effect(() => {
    if (!showSaveDialog) return;
    if (!saveDialogNameInputEl) return;
    saveDialogNameInputEl.focus();
    saveDialogNameInputEl.select();
  });

  // Inline name editing (saved comparisons only)
  let isEditingName = $state(false);
  let editNameValue = $state('');
  let isSavingName = $state(false);
  let nameSaveError = $state<string | null>(null);
  let nameInputEl = $state<HTMLInputElement | null>(null);
  let nameEditorRoot = $state<HTMLDivElement | null>(null);

  const eventIds = $derived.by(() => {
    if (comparisonId && comparisonId !== 'new' && loaderState.comparison) {
      return loaderState.comparison.eventIds;
    }
    return eventIdsFromQuery.filter((id) => id.trim().length > 0);
  });

  const loading = $derived(loaderState.status === 'loading');
  const loadingComparison = $derived(
    Boolean(
      comparisonId &&
      comparisonId !== 'new' &&
      loaderState.comparison === null &&
      !loaderState.error
    )
  );
  const error = $derived(loaderState.error);
  const events = $derived(loaderState.events);
  const inferredFolderId = $derived.by(() => {
    if (comparisonId && comparisonId !== 'new') return null;
    const evs = events;
    if (evs.length === 0) return null;
    const firstFolder = evs[0].event.folderId ?? null;
    if (!firstFolder) return null;
    return evs.every((e) => (e.event.folderId ?? null) === firstFolder) ? firstFolder : null;
  });
  const streamsByEventId = $derived(loaderState.streamsByEventId);
  const selectedActivities = $derived(loaderState.selectedActivities);
  const selectedStreamTypes = $derived(loaderState.selectedStreamTypes);
  const xAxisMode = $derived(loaderState.xAxisMode);
  const savedComparison = $derived(loaderState.comparison);

  // Reference activity / event ID derived from loader state
  const referenceActivityId = $derived(loaderState.referenceActivityId);
  // Back path for event links: return to this comparison when user clicks Back on event detail
  const comparisonBackPath = $derived(
    savedComparison
      ? `/compare/${savedComparison.id}`
      : eventIds.length > 0
        ? `/compare/new?events=${eventIds.join(',')}`
        : '/compare/new'
  );

  const referenceEventId = $derived.by(() => {
    const refActId = referenceActivityId;
    if (!refActId) {
      return events.length > 0 ? events[0].event.id : null;
    }
    for (const [eventId, actId] of Object.entries(selectedActivities)) {
      if (actId === refActId) return eventId;
    }
    return events.length > 0 ? events[0].event.id : null;
  });

  // Get all unique stream types across all events, but only include streams where at least 2 devices have data
  const allStreamTypes = $derived.by(() => {
    const streamCounts = new Map<string, number>();

    // Count how many devices have each stream type
    for (const streamList of Object.values(loaderState.streamsByEventId)) {
      const seenTypes = new Set<string>();
      for (const stream of streamList) {
        if (
          isChartableStream(stream.type) &&
          !isSmoothVariantToHide(
            stream.type,
            streamList.map((s) => s.type)
          )
        ) {
          // Only count each stream type once per device
          if (!seenTypes.has(stream.type)) {
            seenTypes.add(stream.type);
            // Only count if stream has data
            if (stream.data && stream.data.length > 0) {
              streamCounts.set(stream.type, (streamCounts.get(stream.type) || 0) + 1);
            }
          }
        }
      }
    }

    // Filter to only include stream types where at least 2 devices have data
    const filteredTypes = Array.from(streamCounts.entries())
      .filter(([_, count]) => count >= 2)
      .map(([type, _]) => type)
      .sort();

    return filteredTypes;
  });

  // Get all unique stat types across all events, but only include stats where at least 2 devices have data
  const allStatTypes = $derived(
    getComparisonStatTypes(events, selectedActivities, loaderState.hiddenStats)
  );

  function toggleStream(type: string) {
    setSelectedStreamTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const powerCurveSeries = $derived.by(() => {
    const result: Array<{
      activityId: string;
      activityName: string;
      color: string;
      data: Array<{ duration: number; power: number }>;
    }> = [];
    events.forEach((eventDetail, index) => {
      const eventId = eventDetail.event.id;
      const activityId = selectedActivities[eventId];
      if (!activityId) return;
      const activity = eventDetail.activities.find((a) => a.id === activityId);
      if (!activity) return;
      const pc = activity.stats?.['PowerCurve'];
      if (!Array.isArray(pc) || pc.length === 0) return;
      result.push({
        activityId,
        activityName:
          getActivityDeviceName(activity) || eventDetail.event.name || `Activity ${index + 1}`,
        color: EVENT_COLORS[index % EVENT_COLORS.length],
        data: pc as unknown as Array<{ duration: number; power: number }>,
      });
    });
    return result;
  });

  const powerCurveMaxDuration = $derived.by(() => {
    let maxDuration = 0;
    for (const eventDetail of events) {
      const eventId = eventDetail.event.id;
      const activityId = selectedActivities[eventId];
      if (!activityId) continue;
      const activity = eventDetail.activities.find((a) => a.id === activityId);
      if (!activity?.startDate || !activity?.endDate) continue;
      const duration = Math.round((activity.endDate - activity.startDate) / 1000);
      if (duration > maxDuration) maxDuration = duration;
    }
    return maxDuration > 0 ? maxDuration : undefined;
  });

  let selectedPowerCurveIds = $state<Set<string>>(new Set());

  function togglePowerCurveActivity(activityId: string) {
    selectedPowerCurveIds = (() => {
      const next = new Set(selectedPowerCurveIds);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    })();
  }

  function toggleHiddenStat(statType: string) {
    loaderToggleHiddenStat(statType);
    if (savedComparison) {
      const settings = {
        selectedStreams: Array.from(loaderState.selectedStreamTypes),
        xAxisMode: loaderState.xAxisMode,
        hiddenStats: Array.from(loaderState.hiddenStats),
        referenceActivityId: loaderState.referenceActivityId,
      };
      updateComparisonSettings(savedComparison.id, settings).catch((e) => {
        showSettingsError(e instanceof Error ? e.message : 'Failed to save settings');
      });
    }
  }

  function handleClearHiddenStats() {
    loaderClearHiddenStats();
    if (savedComparison) {
      const settings = {
        selectedStreams: Array.from(loaderState.selectedStreamTypes),
        xAxisMode: loaderState.xAxisMode,
        hiddenStats: [],
        referenceActivityId: loaderState.referenceActivityId,
      };
      updateComparisonSettings(savedComparison.id, settings).catch((e) => {
        showSettingsError(e instanceof Error ? e.message : 'Failed to save settings');
      });
    }
  }

  async function handleActivityChange(eventId: string, activityId: string) {
    setSelectedActivities((prev) => ({ ...prev, [eventId]: activityId }));
    await loaderLoadStreams();
  }

  function handleReferenceChange(activityId: string) {
    setReferenceActivityId(activityId);
    if (savedComparison) {
      const settings = {
        selectedStreams: Array.from(loaderState.selectedStreamTypes),
        xAxisMode: loaderState.xAxisMode,
        hiddenStats: Array.from(loaderState.hiddenStats),
        referenceActivityId: activityId,
      };
      updateComparisonSettings(savedComparison.id, settings).catch((e) => {
        showSettingsError(e instanceof Error ? e.message : 'Failed to save settings');
      });
    }
  }

  // Generate auto name for comparison (e.g. "Walking / Pixel Watch 2 vs Kospet Pulse")
  function generateComparisonName(): string {
    function getActivityTypeForEvent(index: number): string | null {
      const eventDetail = events[index];
      const eventId = eventDetail.event.id;
      const activityId = selectedActivities[eventId];
      const activity = eventDetail.activities.find((a) => a.id === activityId);
      const t = activity?.type?.trim();
      const lower = t?.toLowerCase();
      return t && lower !== 'unknown' && lower !== 'other' ? t : null;
    }

    const devicePart =
      events.length === 2
        ? (() => {
            const device1 = (() => {
              const eventId = events[0].event.id;
              const activityId = selectedActivities[eventId];
              const activity = events[0].activities.find((a) => a.id === activityId);
              return activity ? getActivityDeviceName(activity) : null;
            })();
            const device2 = (() => {
              const eventId = events[1].event.id;
              const activityId = selectedActivities[eventId];
              const activity = events[1].activities.find((a) => a.id === activityId);
              return activity ? getActivityDeviceName(activity) : null;
            })();
            return `${device1 || events[0].event.name || 'Event 1'} vs ${device2 || events[1].event.name || 'Event 2'}`;
          })()
        : `${events.length} Events Comparison`;

    const activityType =
      events.length >= 1
        ? (getActivityTypeForEvent(0) ?? getActivityTypeForEvent(1) ?? null)
        : null;
    const prefix = activityType ? `${activityType} / ` : '';
    return prefix + devicePart;
  }

  async function handleSave() {
    if (!saveName.trim()) {
      saveName = generateComparisonName();
      return;
    }

    isSaving = true;
    try {
      const activityIds = eventIds
        .map((id) => loaderState.selectedActivities[id])
        .filter((id): id is string => Boolean(id));

      const settings: ComparisonSettings = {
        selectedStreams: Array.from(loaderState.selectedStreamTypes),
        xAxisMode: loaderState.xAxisMode,
        hiddenStats: Array.from(loaderState.hiddenStats),
        referenceActivityId: loaderState.referenceActivityId,
      };

      const saved = await createComparison(
        saveName.trim(),
        activityIds,
        settings,
        folderIdForNewComparison ?? inferredFolderId ?? undefined
      );
      setComparison(saved);
      showSaveDialog = false;
      saveName = '';
      saveError = null;

      replace(`/compare/${saved.id}`);
    } catch (e) {
      saveError = e instanceof Error ? e.message : 'Failed to save comparison';
    } finally {
      isSaving = false;
    }
  }

  async function handleDelete() {
    if (!savedComparison) return;

    isDeleting = true;
    try {
      await deleteComparison(savedComparison.id);
      push('/comparisons');
    } catch (e) {
      deleteError = e instanceof Error ? e.message : 'Failed to delete comparison';
      isDeleting = false;
    }
  }

  function openNameEditor() {
    if (savedComparison) {
      nameSaveError = null;
      editNameValue = savedComparison.name;
      isEditingName = true;
    }
  }

  function closeNameEditor() {
    isEditingName = false;
    nameSaveError = null;
  }

  async function commitNameUpdate() {
    const comp = savedComparison;
    const trimmed = editNameValue.trim();
    if (!comp || !trimmed) {
      closeNameEditor();
      return;
    }
    isSavingName = true;
    nameSaveError = null;
    try {
      await updateComparisonName(comp.id, trimmed);
      setComparison({ ...comp, name: trimmed });
      closeNameEditor();
    } catch (e) {
      nameSaveError = e instanceof Error ? e.message : 'Failed to update name';
    } finally {
      isSavingName = false;
    }
  }

  function handleNameClickOutside(e: MouseEvent) {
    const target = e.target as Node;
    if (nameEditorRoot && !nameEditorRoot.contains(target)) {
      closeNameEditor();
    }
  }

  $effect(() => {
    if (!isEditingName) return;
    const handler = handleNameClickOutside;
    window.addEventListener('click', handler, true);
    return () => window.removeEventListener('click', handler, true);
  });

  $effect(() => {
    if (isEditingName && nameInputEl) {
      nameInputEl.focus();
      nameInputEl.select();
    }
  });

  // Routes for the comparison map: one per event with location streams, colored by EVENT_COLORS
  const comparisonRoutes = $derived.by(() => {
    const result: Array<{ label: string; color: string; streams: StreamData[] }> = [];
    for (let i = 0; i < events.length; i++) {
      const eventDetail = events[i];
      const eventId = eventDetail.event.id;
      const streams = streamsByEventId[eventId];
      if (!streams || !hasLocationStreams(streams)) continue;
      const activityId = selectedActivities[eventId];
      const activity = eventDetail.activities.find((a) => a.id === activityId);
      const deviceName = activity ? getActivityDeviceName(activity) : null;
      result.push({
        label: deviceName || eventDetail.event.name || `Event ${i + 1}`,
        color: EVENT_COLORS[i % EVENT_COLORS.length],
        streams,
      });
    }
    return result;
  });

  const locationAvailable = $derived(comparisonRoutes.length > 0);

  // Get comparison entries for a stream type
  function getComparisonEntries(streamType: string) {
    const entries = [];
    for (let i = 0; i < events.length; i++) {
      const eventDetail = events[i];
      const eventId = eventDetail.event.id;
      const activityId = selectedActivities[eventId];
      if (!activityId) continue;

      const activity = eventDetail.activities.find((a) => a.id === activityId);
      if (!activity) continue;

      const stream = streamsByEventId[eventId]?.find((s) => s.type === streamType);
      if (!stream || !stream.data || stream.data.length === 0) continue;

      const activityStartDate = activity.startDate ?? eventDetail.event.startDate ?? Date.now();
      // Use distinct colors from EVENT_COLORS for all events (not stream config color)
      const color = EVENT_COLORS[i % EVENT_COLORS.length];

      const deviceName = getActivityDeviceName(activity);
      entries.push({
        eventName: deviceName || eventDetail.event.name || `Event ${i + 1}`,
        color,
        data: stream,
        activityStartDate,
      });
    }
    return entries;
  }
</script>

<section class="mx-auto w-[85%] max-w-screen-2xl py-6">
  <button
    type="button"
    class="mb-4 rounded border border-border px-3 py-1.5 text-base text-text-secondary hover:bg-card-hover hover:text-text-primary"
    onclick={() => {
      if (savedComparison) {
        push('/comparisons');
      } else if (backFolderFromQueryState) {
        push(buildFolderHash(backFolderFromQueryState));
      } else {
        history.back();
      }
    }}
  >
    ← {savedComparison ? 'Back to comparisons' : 'Back to Workouts'}
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
      <p class="text-sm font-medium text-text-primary">
        At least 2 events are required for comparison
      </p>
    </div>
  {:else}
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <div class="name-editor-root" bind:this={nameEditorRoot}>
          {#if isEditingName && savedComparison}
            <div class="flex flex-col gap-1">
              <input
                bind:this={nameInputEl}
                type="text"
                bind:value={editNameValue}
                class="min-w-[20rem] rounded-lg border border-border bg-surface px-3 py-2 text-2xl font-semibold text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="Comparison name"
                disabled={isSavingName}
                onkeydown={(e) => {
                  if (e.key === 'Enter') commitNameUpdate();
                  if (e.key === 'Escape') closeNameEditor();
                }}
              />
              {#if nameSaveError}
                <p class="text-sm text-danger" role="alert">{nameSaveError}</p>
              {/if}
            </div>
          {:else if savedComparison}
            <button
              type="button"
              class="group inline-flex items-center gap-1 rounded px-0.5 py-0.5 text-left text-2xl font-semibold text-text-primary hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              onclick={openNameEditor}
            >
              <span>{savedComparison.name}</span>
              <span
                class="material-icons text-xl text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              >
                edit
              </span>
            </button>
          {:else}
            <h1 class="text-2xl font-semibold text-text-primary">
              {generateComparisonName()}
            </h1>
          {/if}
        </div>
        {#if savedComparison}
          <p class="mt-1 text-sm text-text-secondary">
            Saved {savedComparison.createdAt
              ? new Date(savedComparison.createdAt).toLocaleDateString()
              : ''}
          </p>
          {#if savedComparison.mixed}
            <p class="mt-1 text-sm text-amber-600">
              This comparison includes events from more than one folder.
            </p>
          {/if}
        {/if}
      </div>
      <div class="flex flex-col items-end gap-2">
        {#if savedComparison}
          <button
            type="button"
            class="rounded border border-danger/30 bg-card px-4 py-2 text-sm font-medium text-danger shadow-sm hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger disabled:opacity-50"
            onclick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          {#if deleteError}
            <p class="text-sm text-danger">{deleteError}</p>
          {/if}
        {:else}
          <button
            type="button"
            class="rounded border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent"
            onclick={() => {
              saveName = generateComparisonName();
              saveError = null;
              showSaveDialog = true;
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
                <label
                  for="activity-select-{eventId}"
                  class="mb-1 block text-sm font-medium text-text-secondary"
                >
                  {(() => {
                    const activityId = selectedActivities[eventId];
                    const activity = eventDetail.activities.find((a) => a.id === activityId);
                    return activity
                      ? getActivityDeviceName(activity)
                      : eventDetail.event.name || `Event ${i + 1}`;
                  })()}
                </label>
                <select
                  id="activity-select-{eventId}"
                  class="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary"
                  value={currentActivityId}
                  onchange={(e) =>
                    handleActivityChange(eventId, (e.target as HTMLSelectElement).value)}
                >
                  {#each eventDetail.activities as activity (activity.id)}
                    <option value={activity.id}>
                      {activity.name ||
                        activity.type ||
                        `Activity ${eventDetail.activities.indexOf(activity) + 1}`}
                    </option>
                  {/each}
                </select>
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <!-- Reference Device Picker -->
    <div class="mb-6 space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 class="text-base font-semibold text-text-primary">Reference Device</h2>
      <div class="flex flex-wrap gap-2">
        {#each events as eventDetail, i (eventDetail.event.id)}
          {@const eventId = eventDetail.event.id}
          {@const activityId = selectedActivities[eventId]}
          {@const activity = eventDetail.activities.find((a) => a.id === activityId)}
          {@const deviceName = activity
            ? getActivityDeviceName(activity)
            : eventDetail.event.name || `Event ${i + 1}`}
          {@const isRef = referenceEventId === eventId}
          {@const color = EVENT_COLORS[i % EVENT_COLORS.length]}
          <div
            class="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors {isRef
              ? 'text-text-primary'
              : 'border-border bg-transparent text-text-secondary'}"
            style={isRef ? `background-color: ${color}20; border-color: ${color}80` : ''}
          >
            <button
              type="button"
              class="flex items-center gap-2 rounded-full -m-1.5 p-1.5 text-inherit hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent {!isRef
                ? 'hover:bg-card-hover'
                : ''}"
              onclick={() => activityId && handleReferenceChange(activityId)}
            >
              <span class="h-2 w-2 rounded-full" style="background-color: {color};"></span>
              {deviceName}
              {#if isRef}
                <span
                  class="rounded bg-accent/15 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent"
                  >Ref</span
                >
              {/if}
            </button>
            <button
              type="button"
              class="rounded p-0.5 text-text-muted hover:bg-accent/10 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              title="View original event"
              aria-label="View original event"
              onclick={() =>
                push(`/event/${eventId}?back=${encodeURIComponent(comparisonBackPath)}`)}
            >
              <span class="material-icons text-sm" aria-hidden="true">open_in_new</span>
            </button>
          </div>
        {/each}
      </div>
    </div>

    {#if settingsSaveError}
      <div
        class="mb-4 rounded-md border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger"
        role="alert"
      >
        {settingsSaveError}
      </div>
    {/if}

    {#if loaderState.hiddenStats.size > 0}
      <div class="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 text-text-secondary"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
          />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        <span class="text-sm text-text-secondary">
          {loaderState.hiddenStats.size}
          {loaderState.hiddenStats.size === 1 ? 'row' : 'rows'} hidden
        </span>
        <button
          type="button"
          class="ml-auto text-sm text-accent hover:underline"
          onclick={handleClearHiddenStats}
        >
          Show all
        </button>
      </div>
    {/if}

    <ComparisonStatsTable
      {events}
      {selectedActivities}
      {allStatTypes}
      eventColors={EVENT_COLORS}
      {getActivityDeviceName}
      {calculateDelta}
      onHideStat={toggleHiddenStat}
      referenceEventId={referenceEventId ?? undefined}
      onNavigateToEvent={(eventId) =>
        push(`/event/${eventId}?back=${encodeURIComponent(comparisonBackPath)}`)}
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
              onclick={() => setXAxisMode('elapsed')}
            >
              Elapsed
            </button>
            <button
              type="button"
              class="rounded border px-3 py-1 text-sm transition-colors {xAxisMode === 'wall-clock'
                ? 'border-border bg-card text-text-primary'
                : 'border-border bg-transparent text-text-secondary hover:bg-card-hover'}"
              onclick={() => setXAxisMode('wall-clock')}
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
            style={isSelected
              ? `background-color: ${config.color}26; border-color: ${config.color}66`
              : ''}
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
            <ComparisonChartCard {streamType} {entries} {xAxisMode} />
          {/each}
        </div>
      {:else}
        <div class="flex h-32 items-center justify-center rounded-lg border border-border bg-card">
          <p class="text-sm text-text-secondary">Select stream types above to view charts</p>
        </div>
      {/if}
    </div>

    <!-- Power Curve Section -->
    {#if powerCurveSeries.length > 0}
      <div
        bind:this={powerCurveSectionEl}
        class="mb-6 overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm backdrop-blur-lg"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-base font-semibold text-text-primary">Power Curve</h3>
          {#if powerCurveSectionEl}
            <ExportButton
              onExport={() => exportAsPng(powerCurveSectionEl!, 'power-curve-comparison')}
              title="Export chart as PNG"
            />
          {/if}
        </div>
        <PowerCurveChart
          series={powerCurveSeries}
          showToggleButtons={true}
          selectedActivityIds={selectedPowerCurveIds}
          onToggleActivity={togglePowerCurveActivity}
          maxDuration={powerCurveMaxDuration}
        />
      </div>
    {/if}

    <!-- Stream Analysis Section -->
    <StreamAnalysisSection
      {events}
      {streamsByEventId}
      {selectedActivities}
      {referenceActivityId}
      eventColors={EVENT_COLORS}
    />
  {/if}

  <!-- Save Dialog -->
  {#if showSaveDialog}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-comparison-dialog-title"
      tabindex="-1"
      onclick={() => {
        showSaveDialog = false;
        saveError = null;
      }}
      onkeydown={(e) => {
        if (e.key === 'Escape') {
          showSaveDialog = false;
          saveError = null;
        }
      }}
    >
      <div
        class="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl backdrop-blur-xl"
        role="presentation"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <h2 id="save-comparison-dialog-title" class="mb-4 text-lg font-semibold text-text-primary">
          Save Comparison
        </h2>
        <div class="mb-6">
          <label
            for="save-comparison-name"
            class="mb-2 block text-sm font-medium text-text-secondary"
          >
            Name
          </label>
          <input
            id="save-comparison-name"
            type="text"
            class="w-full rounded border border-border bg-card px-3 py-2 text-text-primary"
            bind:this={saveDialogNameInputEl}
            bind:value={saveName}
            placeholder="Enter comparison name"
            onkeydown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') showSaveDialog = false;
            }}
          />
          {#if (folderIdForNewComparison ?? inferredFolderId) != null}
            {@const effectiveFolderId = folderIdForNewComparison ?? inferredFolderId}
            {@const folder = foldersState.folders.find((f: Folder) => f.id === effectiveFolderId)}
            <p class="mt-2 text-sm text-text-secondary">
              Will be saved to: {folder?.name ?? 'Unknown folder'}
            </p>
          {/if}
          {#if saveError}
            <p class="mt-2 text-sm text-danger">{saveError}</p>
          {/if}
        </div>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover"
            onclick={() => {
              showSaveDialog = false;
              saveError = null;
            }}
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
