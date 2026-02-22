<script lang="ts">
  import { onMount } from 'svelte'
  import { push, querystring } from 'svelte-spa-router'
  import { getActivityRows, getActivityTypes, getDevices, uploadFile, deleteEvent } from '../lib/api'
  import type { ActivityRow } from '../lib/types'
  import {
    formatDurationCell,
    formatAvgHeartRateCell,
    formatCaloriesCell,
    formatDistanceCell,
  } from '../lib/utils/dashboard-table-formatters'
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte'
  import UploadProgressBar from '../lib/components/UploadProgressBar.svelte'
  import DashboardUploadSection from '../lib/components/dashboard/DashboardUploadSection.svelte'
  import DashboardToast from '../lib/components/dashboard/DashboardToast.svelte'
  import DashboardBulkActionBar from '../lib/components/dashboard/DashboardBulkActionBar.svelte'
  import DashboardBulkDeleteFlow from '../lib/components/dashboard/DashboardBulkDeleteFlow.svelte'
  import CompareCandidatesFlow from '../lib/components/dashboard/CompareCandidatesFlow.svelte'
  import ConfirmDialog from '../lib/components/dashboard/ConfirmDialog.svelte'
  import DashboardFilters from '../lib/components/dashboard/DashboardFilters.svelte'
  import DashboardPaginator from '../lib/components/dashboard/DashboardPaginator.svelte'
  import CompareCandidatesModal from '../lib/components/dashboard/CompareCandidatesModal.svelte'
  import DashboardActivityTable from '../lib/components/dashboard/DashboardActivityTable.svelte'

  let activityRowsFromApi = $state<ActivityRow[]>([])
  let totalRows = $state(0)
  let isLoading = $state(false)
  let search = $state('')
  let selectedActivityTypes = $state<string[]>([])
  let selectedDevices = $state<string[]>([])
  let dateStartStr = $state('')
  let dateEndStr = $state('')
  const PAGE_SIZE_OPTIONS = [20, 30, 40, 50] as const
  function parsePageFromQueryString(qs: string): { page: number; pageSize: number } {
    const params = new URLSearchParams(qs)
    const p = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1)
    const ps = parseInt(params.get('pageSize') ?? '20', 10)
    const valid = PAGE_SIZE_OPTIONS.includes(ps as (typeof PAGE_SIZE_OPTIONS)[number])
    return { page: p, pageSize: valid ? ps : 20 }
  }
  function getInitialQueryString(): string {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const qi = hash.indexOf('?')
    return qi === -1 ? '' : hash.slice(qi + 1)
  }
  const initial = parsePageFromQueryString(getInitialQueryString())
  let page = $state(initial.page)
  let pageSize = $state(initial.pageSize)
  let activityTypesOptions = $state<string[]>([])
  let devicesOptions = $state<string[]>([])
  let searchInputValue = $state('')
  let searchDebounceId: ReturnType<typeof setTimeout> | null = null

  function commitSearch() {
    if (searchDebounceId) {
      clearTimeout(searchDebounceId)
      searchDebounceId = null
    }
    search = searchInputValue
    page = 1
  }

  function onSearchInput() {
    if (searchDebounceId) clearTimeout(searchDebounceId)
    searchDebounceId = setTimeout(commitSearch, 300)
  }

  function toggleActivityType(type: string) {
    const next = selectedActivityTypes.includes(type)
      ? selectedActivityTypes.filter((t) => t !== type)
      : [...selectedActivityTypes, type]
    selectedActivityTypes = next
    page = 1
  }

  function toggleDevice(device: string) {
    const next = selectedDevices.includes(device)
      ? selectedDevices.filter((d) => d !== device)
      : [...selectedDevices, device]
    selectedDevices = next
    page = 1
  }

  function setDateStart(value: string) {
    dateStartStr = value
    page = 1
  }

  function setDateEnd(value: string) {
    dateEndStr = value
    page = 1
  }
  let isUploading = $state(false)
  let isDraggingOver = $state(false)
  let uploadProgress = $state(0)
  let currentFileIndex = $state(0)
  let totalFiles = $state(0)
  let currentFileName = $state<string | null>(null)
  let toastMessage = $state<string | null>(null)
  let toastTimeout: ReturnType<typeof setTimeout> | null = null
  let eventToDelete = $state<string | null>(null)
  let isDeleting = $state(false)
  let selectedEventIds = $state<Set<string>>(new Set())
  let eventsToBulkDelete = $state<string[]>([])
  let compareCandidatesFlow: CompareCandidatesFlow | undefined = $state(undefined)

  function showToast(message: string) {
    toastMessage = message
    if (toastTimeout) clearTimeout(toastTimeout)
    toastTimeout = setTimeout(() => {
      toastMessage = null
      toastTimeout = null
    }, 5000)
  }

  $effect(() => {
    return () => {
      if (toastTimeout) clearTimeout(toastTimeout)
    }
  })

  async function loadActivityRows() {
    isLoading = true
    try {
      const offset = (page - 1) * pageSize
      const startDate = dateStartStr
        ? new Date(dateStartStr + 'T00:00:00').getTime()
        : undefined
      const endDate = dateEndStr
        ? new Date(dateEndStr + 'T23:59:59.999').getTime()
        : undefined
      const params: Parameters<typeof getActivityRows>[0] = {
        limit: pageSize,
        offset,
        startDate,
        endDate,
        activityTypes: selectedActivityTypes.length ? selectedActivityTypes : undefined,
        devices: selectedDevices.length ? selectedDevices : undefined,
        search: search.trim() || undefined,
      }
      const result = await getActivityRows(params)
      activityRowsFromApi = result.rows
      totalRows = result.total
    } catch (error) {
      console.error('Failed to load activity rows:', error)
      showToast(error instanceof Error ? error.message : 'Failed to load activity rows')
    } finally {
      isLoading = false
    }
  }

  function resetPageAndLoad() {
    page = 1
    loadActivityRows()
  }

  async function handleFiles(fileList: File[]) {
    isUploading = true
    totalFiles = fileList.length
    let successful = 0
    let failed = 0

    try {
      for (let index = 0; index < fileList.length; index++) {
        const file = fileList[index]
        currentFileIndex = index
        currentFileName = file.name
        uploadProgress = 0

        try {
          await uploadFile(file, (progress) => {
            uploadProgress = progress
          })
          successful++
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error)
          failed++
        }
      }

      if (successful > 0) {
        showToast(`Uploaded ${successful} file${successful > 1 ? 's' : ''} successfully`)
        await loadActivityRows()
      }
      if (failed > 0) {
        showToast(`Failed to upload ${failed} file${failed > 1 ? 's' : ''}`)
      }
    } finally {
      isUploading = false
      uploadProgress = 0
      currentFileIndex = 0
      totalFiles = 0
      currentFileName = null
    }
  }

  function handleDeleteClick(eventId: string, event: MouseEvent) {
    event.stopPropagation()
    eventToDelete = eventId
  }

  function handleCancelDelete() {
    eventToDelete = null
  }

  async function handleConfirmDelete() {
    if (!eventToDelete) return

    isDeleting = true
    try {
      const deleted = await deleteEvent(eventToDelete)
      if (deleted) {
        showToast('Event deleted successfully')
        await loadActivityRows()
      } else {
        showToast('Event not found')
      }
    } catch (error) {
      console.error('Failed to delete event:', error)
      showToast(error instanceof Error ? error.message : 'Failed to delete event')
    } finally {
      isDeleting = false
      eventToDelete = null
    }
  }

  onMount(() => {
    getActivityTypes().then((r) => { activityTypesOptions = r })
    getDevices().then((r) => { devicesOptions = r })
    lastQuerystringSynced = undefined
  })

  $effect(() => {
    void loadActivityRows()
  })

  $effect(() => {
    if (totalPages > 0 && page > totalPages) {
      page = totalPages
    }
  })

  // Unique event IDs on current page (for select-all)
  const uniqueEventIds = $derived.by(() => {
    const ids = new Set<string>()
    for (const row of activityRowsFromApi) {
      ids.add(row.event.id)
    }
    return Array.from(ids)
  })

  const totalPages = $derived(Math.max(1, Math.ceil(totalRows / pageSize)))

  function buildDashboardPath(p: number, ps: number): string {
    const parts: string[] = []
    parts.push(`page=${p}`)
    if (ps !== 20) parts.push(`pageSize=${ps}`)
    return `/?${parts.join('&')}`
  }

  let suppressUrlSync = false
  let lastQuerystringSynced = $state<string | undefined>(undefined)

  $effect(() => {
    const qs = $querystring ?? ''
    if (lastQuerystringSynced !== undefined && qs === lastQuerystringSynced) return
    lastQuerystringSynced = qs
    const parsed = parsePageFromQueryString(qs)
    suppressUrlSync = true
    page = parsed.page
    pageSize = parsed.pageSize
    queueMicrotask(() => { suppressUrlSync = false })
  })

  $effect(() => {
    const p = page
    const ps = pageSize
    if (suppressUrlSync) return
    const target = buildDashboardPath(p, ps)
    const currentQs = $querystring ?? ''
    const current = parsePageFromQueryString(currentQs)
    if (current.page !== p || current.pageSize !== ps) {
      push(target)
    }
  })

  const pageRangeStart = $derived(totalRows === 0 ? 0 : (page - 1) * pageSize + 1)
  const pageRangeEnd = $derived(totalRows === 0 ? 0 : Math.min(page * pageSize, totalRows))
  const pageRangeText = $derived(
    totalRows === 0 ? '0 of 0' : pageRangeStart === pageRangeEnd ? `${pageRangeStart} of ${totalRows}` : `${pageRangeStart}-${pageRangeEnd} of ${totalRows}`
  )

  /** Paginator uses URL as source of truth so Back/Forward and return-from-route always show correct page */
  const currentPageFromUrl = $derived.by(() => {
    const parsed = parsePageFromQueryString($querystring ?? '')
    const total = totalPages
    return Math.min(Math.max(1, parsed.page), total)
  })

  const visiblePageNumbers = $derived.by(() => {
    const total = totalPages
    if (total <= 1) return []
    const current = Math.min(currentPageFromUrl, total)
    const delta = 2
    const range: number[] = []
    const add = (n: number) => {
      if (n >= 1 && n <= total && !range.includes(n)) range.push(n)
    }
    add(1)
    for (let i = current - delta; i <= current + delta; i++) add(i)
    add(total)
    range.sort((a, b) => a - b)
    return range
  })

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return
    const target = buildDashboardPath(p, pageSize)
    const newQs = target.slice(target.indexOf('?') + 1)
    lastQuerystringSynced = newQs
    push(target)
    page = p
  }

  function onPageSizeChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value
    const n = Number(val) as (typeof PAGE_SIZE_OPTIONS)[number]
    if (PAGE_SIZE_OPTIONS.includes(n)) {
      pageSize = n
      page = 1
    }
  }

  // Selection state for select-all checkbox
  const selectAllChecked = $derived.by(() => {
    if (uniqueEventIds.length === 0) return false
    return uniqueEventIds.every((id) => selectedEventIds.has(id))
  })

  const selectAllIndeterminate = $derived.by(() => {
    if (uniqueEventIds.length === 0) return false
    const selectedCount = uniqueEventIds.filter((id) => selectedEventIds.has(id)).length
    return selectedCount > 0 && selectedCount < uniqueEventIds.length
  })

  function toggleSelectAll() {
    if (selectAllChecked) {
      selectedEventIds = new Set()
    } else {
      selectedEventIds = new Set(uniqueEventIds)
    }
  }

  function toggleEventSelection(eventId: string) {
    const newSet = new Set(selectedEventIds)
    if (newSet.has(eventId)) {
      newSet.delete(eventId)
    } else {
      newSet.add(eventId)
    }
    selectedEventIds = newSet
  }

  function clearSelection() {
    selectedEventIds = new Set()
  }

  function handleBulkDeleteClick() {
    const eventIds = Array.from(selectedEventIds)
    if (eventIds.length === 0) return
    eventsToBulkDelete = eventIds
  }

  function handleBulkDeleteDone(successful: number, failed: number) {
    if (successful > 0) {
      showToast(`Deleted ${successful} event${successful > 1 ? 's' : ''} successfully`)
      loadActivityRows()
    }
    if (failed > 0) {
      showToast(`Failed to delete ${failed} event${failed > 1 ? 's' : ''}`)
    }
    clearSelection()
  }

  // Reference for select-all checkbox to set indeterminate state
  let selectAllCheckbox: HTMLInputElement | null = null

  $effect(() => {
    if (selectAllCheckbox) {
      selectAllCheckbox.indeterminate = selectAllIndeterminate
    }
  })

</script>

<section
  class="mx-auto w-[85%] max-w-screen-2xl py-6 transition-opacity"
  class:opacity-50={isDraggingOver && !isUploading}
>
  <DashboardUploadSection
    isUploading={isUploading}
    onFilesSelected={handleFiles}
    bind:isDraggingOver
  >
    <svelte:fragment slot="bulkBar">
      <DashboardBulkActionBar
        selectedCount={selectedEventIds.size}
        disabled={eventsToBulkDelete.length > 0 || isDeleting}
        onClear={clearSelection}
        onCompare={() => {
          if (selectedEventIds.size >= 2) {
            push(`/compare/new?events=${Array.from(selectedEventIds).join(',')}`)
          }
        }}
        onDelete={handleBulkDeleteClick}
      />
    </svelte:fragment>

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
      totalFiles={totalFiles}
      progress={uploadProgress}
      fileName={currentFileName || undefined}
    />
  {/if}

  <DashboardBulkDeleteFlow
    eventIdsToDelete={eventsToBulkDelete}
    deleteEvent={deleteEvent}
    onDone={handleBulkDeleteDone}
    onClosed={() => {
      eventsToBulkDelete = []
    }}
    isDeleting={isDeleting}
  />

  <DashboardToast message={toastMessage} />

  <DashboardFilters
    bind:searchInputValue
    onSearchInput={onSearchInput}
    activityTypesOptions={activityTypesOptions}
    selectedActivityTypes={selectedActivityTypes}
    onToggleActivityType={toggleActivityType}
    devicesOptions={devicesOptions}
    selectedDevices={selectedDevices}
    onToggleDevice={toggleDevice}
    dateStartStr={dateStartStr}
    dateEndStr={dateEndStr}
    onDateStartChange={setDateStart}
    onDateEndChange={setDateEnd}
  />

  <!-- Pagination (above table) -->
  <div class="mb-3">
    <DashboardPaginator
      totalRows={totalRows}
      pageSize={pageSize}
      totalPages={totalPages}
      currentPageFromUrl={currentPageFromUrl}
      visiblePageNumbers={visiblePageNumbers}
      pageRangeText={pageRangeText}
      onPageSizeChange={onPageSizeChange}
      goToPage={goToPage}
    />
  </div>

  <DashboardActivityTable
    rows={activityRowsFromApi}
    isLoading={isLoading}
    selectedEventIds={selectedEventIds}
    uniqueEventIds={uniqueEventIds}
    selectAllChecked={selectAllChecked}
    selectAllIndeterminate={selectAllIndeterminate}
    bind:selectAllCheckbox
    formatDurationCell={formatDurationCell}
    formatAvgHeartRateCell={formatAvgHeartRateCell}
    formatCaloriesCell={formatCaloriesCell}
    formatDistanceCell={formatDistanceCell}
    onSelectAllChange={toggleSelectAll}
    onRowClick={(id) => push(`/event/${id}`)}
    onToggleEventSelection={toggleEventSelection}
    onViewClick={(id, e) => {
      e.stopPropagation()
      push(`/event/${id}`)
    }}
    onFindComparisonsClick={(id) => compareCandidatesFlow?.openForEvent(id)}
    onDeleteClick={handleDeleteClick}
  />

  <!-- Pagination (below table) -->
  <div class="mt-3">
    <DashboardPaginator
      totalRows={totalRows}
      pageSize={pageSize}
      totalPages={totalPages}
      currentPageFromUrl={currentPageFromUrl}
      visiblePageNumbers={visiblePageNumbers}
      pageRangeText={pageRangeText}
      idSuffix="-bottom"
      onPageSizeChange={onPageSizeChange}
      goToPage={goToPage}
    />
  </div>

  {#if eventToDelete}
    <ConfirmDialog
      title="Delete Event?"
      message="Are you sure you want to delete this event? This action cannot be undone."
      confirmLabel="Delete"
      loading={isDeleting}
      danger={true}
      confirmDisabled={isDeleting || eventsToBulkDelete.length > 0}
      onConfirm={handleConfirmDelete}
      onCancel={handleCancelDelete}
    />
  {/if}

  <CompareCandidatesFlow
    bind:this={compareCandidatesFlow}
    activityRows={activityRowsFromApi}
    onCompare={(eventIds) => push(`/compare/new?events=${eventIds.join(',')}`)}
    onError={showToast}
  />
  </DashboardUploadSection>
</section>
