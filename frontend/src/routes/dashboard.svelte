<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { push } from 'svelte-spa-router';
  import {
    getActivityRows,
    getActivityTypes,
    getDevices,
    uploadFiles,
    deleteEvent,
  } from '../lib/api';
  import type { ActivityRow } from '../lib/types';
  import { getEnvNumber } from '../lib/utils/env';
  import {
    formatDurationCell,
    formatAvgHeartRateCell,
    formatCaloriesCell,
    formatDistanceCell,
  } from '../lib/utils/dashboard-table-formatters';
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte';
  import UploadProgressBar from '../lib/components/UploadProgressBar.svelte';
  import DashboardUploadSection from '../lib/components/dashboard/DashboardUploadSection.svelte';
  import DashboardToast from '../lib/components/dashboard/DashboardToast.svelte';
  import DashboardBulkActionBar from '../lib/components/dashboard/DashboardBulkActionBar.svelte';
  import DashboardBulkDeleteFlow from '../lib/components/dashboard/DashboardBulkDeleteFlow.svelte';
  import CompareCandidatesFlow from '../lib/components/dashboard/CompareCandidatesFlow.svelte';
  import DashboardSingleDeleteFlow from '../lib/components/dashboard/DashboardSingleDeleteFlow.svelte';
  import DashboardFilters from '../lib/components/dashboard/DashboardFilters.svelte';
  import DashboardPaginationWithUrl from '../lib/components/dashboard/DashboardPaginationWithUrl.svelte';
  import DashboardActivityTable from '../lib/components/dashboard/DashboardActivityTable.svelte';

  let activityRowsFromApi = $state<ActivityRow[]>([]);
  let totalRows = $state(0);
  let isLoading = $state(false);
  let loadGeneration = $state(0);
  let search = $state('');
  let selectedActivityTypes = $state<string[]>([]);
  let selectedDevices = $state<string[]>([]);
  let dateStartStr = $state('');
  let dateEndStr = $state('');
  let page = $state(1);
  let pageSize = $state(20);
  let activityTypesOptions = $state<string[]>([]);
  let devicesOptions = $state<string[]>([]);
  let searchInputValue = $state('');
  let searchDebounceId: ReturnType<typeof setTimeout> | null = null;

  function commitSearch() {
    if (searchDebounceId) {
      clearTimeout(searchDebounceId);
      searchDebounceId = null;
    }
    search = searchInputValue;
    page = 1;
  }

  function onSearchInput() {
    if (searchDebounceId) clearTimeout(searchDebounceId);
    searchDebounceId = setTimeout(commitSearch, 300);
  }

  function toggleActivityType(type: string) {
    const next = selectedActivityTypes.includes(type)
      ? selectedActivityTypes.filter((t) => t !== type)
      : [...selectedActivityTypes, type];
    selectedActivityTypes = next;
    page = 1;
  }

  function toggleDevice(device: string) {
    const next = selectedDevices.includes(device)
      ? selectedDevices.filter((d) => d !== device)
      : [...selectedDevices, device];
    selectedDevices = next;
    page = 1;
  }

  function setDateStart(value: string) {
    dateStartStr = value;
    page = 1;
  }

  function setDateEnd(value: string) {
    dateEndStr = value;
    page = 1;
  }
  let isUploading = $state(false);
  let isDraggingOver = $state(false);
  let uploadProgress = $state(0);
  let currentFileIndex = $state(0);
  let totalFiles = $state(0);
  let currentFileName = $state<string | null>(null);
  let toastMessage = $state<string | null>(null);
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;
  let eventToDelete = $state<string | null>(null);
  let selectedEventIds = $state<Set<string>>(new Set());
  let eventsToBulkDelete = $state<string[]>([]);
  let compareCandidatesFlow: CompareCandidatesFlow | undefined = $state(undefined);

  function showToast(message: string) {
    toastMessage = message;
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastMessage = null;
      toastTimeout = null;
    }, 5000);
  }

  $effect(() => {
    return () => {
      if (toastTimeout) clearTimeout(toastTimeout);
    };
  });

  async function loadActivityRows() {
    const myGen = untrack(() => {
      loadGeneration += 1;
      return loadGeneration;
    });
    isLoading = true;
    try {
      const offset = (page - 1) * pageSize;
      const startDate = dateStartStr ? new Date(dateStartStr + 'T00:00:00').getTime() : undefined;
      const endDate = dateEndStr ? new Date(dateEndStr + 'T23:59:59.999').getTime() : undefined;
      const params: Parameters<typeof getActivityRows>[0] = {
        limit: pageSize,
        offset,
        startDate,
        endDate,
        activityTypes: selectedActivityTypes.length ? selectedActivityTypes : undefined,
        devices: selectedDevices.length ? selectedDevices : undefined,
        search: search.trim() || undefined,
      };
      const result = await getActivityRows(params);
      if (myGen !== loadGeneration) return;
      activityRowsFromApi = result.rows;
      totalRows = result.total;
    } catch (error) {
      if (myGen !== loadGeneration) return;
      console.error('Failed to load activity rows:', error);
      showToast(error instanceof Error ? error.message : 'Failed to load activity rows');
    } finally {
      if (myGen === loadGeneration) isLoading = false;
    }
  }

  function _resetPageAndLoad() {
    page = 1;
    loadActivityRows();
  }

  const UPLOAD_CHUNK_SIZE = getEnvNumber('VITE_UPLOAD_CHUNK_SIZE', {
    default: 5,
    min: 1,
    max: 10,
  });

  async function handleFiles(fileList: File[]) {
    isUploading = true;
    totalFiles = fileList.length;
    let successful = 0;
    const failedFilenames: string[] = [];

    try {
      for (let i = 0; i < fileList.length; i += UPLOAD_CHUNK_SIZE) {
        const chunk = fileList.slice(i, i + UPLOAD_CHUNK_SIZE);
        currentFileIndex = i;
        currentFileName = chunk[0]?.name ?? null;
        // Set progress to the start of this chunk (0% for first, ~24% for 11-20 of 42, etc.)
        uploadProgress = totalFiles > 0 ? (i / totalFiles) * 100 : 0;

        let firstProgressInChunk = true;
        try {
          const { results } = await uploadFiles(chunk, (chunkProgress) => {
            // First event can fire with 100% (loaded===total) before bytes are sent; treat as 0
            // so the bar stays at chunk-start% until upload actually progresses.
            let effective = chunkProgress;
            if (firstProgressInChunk) {
              firstProgressInChunk = false;
              if (chunkProgress > 0) effective = 0;
            }
            const completed = i + (effective / 100) * chunk.length;
            uploadProgress = totalFiles > 0 ? (completed / totalFiles) * 100 : 0;
          });
          for (const r of results) {
            if (r.success) successful++;
            else failedFilenames.push(r.filename);
          }
        } catch (error) {
          console.error(`Failed to upload batch:`, error);
          for (const file of chunk) {
            failedFilenames.push(file.name);
          }
        }
      }

      if (successful > 0) {
        showToast(`Uploaded ${successful} file${successful > 1 ? 's' : ''} successfully`);
        await loadActivityRows();
      }
      if (failedFilenames.length > 0) {
        const sorted = [...failedFilenames].sort((a, b) => a.localeCompare(b));
        const list = sorted.join(', ');
        showToast(
          `Failed to upload ${failedFilenames.length} file${failedFilenames.length > 1 ? 's' : ''}: ${list}`
        );
      }
    } finally {
      isUploading = false;
      uploadProgress = 0;
      currentFileIndex = 0;
      totalFiles = 0;
      currentFileName = null;
    }
  }

  function handleDeleteClick(eventId: string, event: MouseEvent) {
    event.stopPropagation();
    eventToDelete = eventId;
  }

  onMount(() => {
    getActivityTypes().then((r) => {
      activityTypesOptions = r;
    });
    getDevices().then((r) => {
      devicesOptions = r;
    });
  });

  $effect(() => {
    void loadActivityRows();
  });

  // Unique event IDs on current page (for select-all)
  const uniqueEventIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const row of activityRowsFromApi) {
      ids.add(row.event.id);
    }
    return Array.from(ids);
  });

  // Selection state for select-all checkbox
  const selectAllChecked = $derived.by(() => {
    if (uniqueEventIds.length === 0) return false;
    return uniqueEventIds.every((id) => selectedEventIds.has(id));
  });

  const selectAllIndeterminate = $derived.by(() => {
    if (uniqueEventIds.length === 0) return false;
    const selectedCount = uniqueEventIds.filter((id) => selectedEventIds.has(id)).length;
    return selectedCount > 0 && selectedCount < uniqueEventIds.length;
  });

  function toggleSelectAll() {
    if (selectAllChecked) {
      selectedEventIds = new Set();
    } else {
      selectedEventIds = new Set(uniqueEventIds);
    }
  }

  function toggleEventSelection(eventId: string) {
    const newSet = new Set(selectedEventIds);
    if (newSet.has(eventId)) {
      newSet.delete(eventId);
    } else {
      newSet.add(eventId);
    }
    selectedEventIds = newSet;
  }

  function clearSelection() {
    selectedEventIds = new Set();
  }

  function handleBulkDeleteClick() {
    const eventIds = Array.from(selectedEventIds);
    if (eventIds.length === 0) return;
    eventsToBulkDelete = eventIds;
  }

  function handleBulkDeleteDone(successful: number, failed: number) {
    if (successful > 0) {
      showToast(`Deleted ${successful} event${successful > 1 ? 's' : ''} successfully`);
      loadActivityRows();
    }
    if (failed > 0) {
      showToast(`Failed to delete ${failed} event${failed > 1 ? 's' : ''}`);
    }
    clearSelection();
  }

  // Reference for select-all checkbox to set indeterminate state
  let selectAllCheckbox = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (selectAllCheckbox) {
      selectAllCheckbox.indeterminate = selectAllIndeterminate;
    }
  });
</script>

<section
  class="mx-auto w-[85%] max-w-screen-2xl py-6 transition-opacity"
  class:opacity-50={isDraggingOver && !isUploading}
>
  <DashboardUploadSection {isUploading} onFilesSelected={handleFiles} bind:isDraggingOver>
    {#snippet bulkBar()}
      <DashboardBulkActionBar
        selectedCount={selectedEventIds.size}
        disabled={eventsToBulkDelete.length > 0 || eventToDelete !== null}
        onClear={clearSelection}
        onCompare={() => {
          if (selectedEventIds.size >= 2) {
            push(`/compare/new?events=${Array.from(selectedEventIds).join(',')}`);
          }
        }}
        onDelete={handleBulkDeleteClick}
      />
    {/snippet}

    <!-- Loading Spinner (only for loading events, not uploads) -->
    {#if isLoading}
      <div class="mb-4">
        <LoadingSpinner />
      </div>
    {/if}

    <!-- Upload Progress Bar -->
    {#if isUploading}
      <UploadProgressBar
        currentFile={currentFileIndex + 1}
        currentBatchEnd={totalFiles > 0
          ? currentFileIndex + Math.min(UPLOAD_CHUNK_SIZE, totalFiles - currentFileIndex)
          : undefined}
        {totalFiles}
        progress={uploadProgress}
        fileName={currentFileName || undefined}
      />
    {/if}

    <DashboardBulkDeleteFlow
      eventIdsToDelete={eventsToBulkDelete}
      {deleteEvent}
      onDone={handleBulkDeleteDone}
      onClosed={() => {
        eventsToBulkDelete = [];
      }}
      isDeleting={eventToDelete !== null}
    />

    <DashboardToast message={toastMessage} />

    <DashboardFilters
      bind:searchInputValue
      {onSearchInput}
      {activityTypesOptions}
      {selectedActivityTypes}
      onToggleActivityType={toggleActivityType}
      {devicesOptions}
      {selectedDevices}
      onToggleDevice={toggleDevice}
      {dateStartStr}
      {dateEndStr}
      onDateStartChange={setDateStart}
      onDateEndChange={setDateEnd}
    />

    <DashboardPaginationWithUrl {totalRows} bind:page bind:pageSize>
      <DashboardActivityTable
        rows={activityRowsFromApi}
        {isLoading}
        {selectedEventIds}
        {uniqueEventIds}
        {selectAllChecked}
        {selectAllIndeterminate}
        bind:selectAllCheckbox
        {formatDurationCell}
        {formatAvgHeartRateCell}
        {formatCaloriesCell}
        {formatDistanceCell}
        onSelectAllChange={toggleSelectAll}
        onRowClick={(id) => push(`/event/${id}`)}
        onToggleEventSelection={toggleEventSelection}
        onViewClick={(id, e) => {
          e.stopPropagation();
          push(`/event/${id}`);
        }}
        onFindComparisonsClick={(id) => compareCandidatesFlow?.openForEvent(id)}
        onDeleteClick={handleDeleteClick}
      />
    </DashboardPaginationWithUrl>

    <DashboardSingleDeleteFlow
      eventIdToDelete={eventToDelete}
      {deleteEvent}
      onDone={() => {
        showToast('Event deleted successfully');
        loadActivityRows();
      }}
      onClosed={() => {
        eventToDelete = null;
      }}
      onError={showToast}
      confirmDisabledWhen={eventsToBulkDelete.length > 0}
    />

    <CompareCandidatesFlow
      bind:this={compareCandidatesFlow}
      activityRows={activityRowsFromApi}
      onCompare={(eventIds) => push(`/compare/new?events=${eventIds.join(',')}`)}
      onError={showToast}
    />
  </DashboardUploadSection>
</section>
