<script lang="ts">
  import { onMount } from 'svelte'
  import { push, querystring } from 'svelte-spa-router'
  import { getActivityRows, getActivityTypes, getDevices, uploadFile, deleteEvent, getComparisonCandidates } from '../lib/api'
  import type { EventSummary, Activity, ActivityRow } from '../lib/types'
  import { formatDateShort, formatDateWithTime, getActivityIcon, getActivityDeviceName } from '../lib/utils'
  import { findStatByMetric } from '../lib/utils/stat-categories'
  import { formatStatValue } from '../lib/utils/stat-formatting'
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte'
  import UploadProgressBar from '../lib/components/UploadProgressBar.svelte'
  import DropZoneOverlay from '../lib/components/DropZoneOverlay.svelte'

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
  let activityTypeDropdownOpen = $state(false)
  let deviceDropdownOpen = $state(false)
  let activityTypeFilter = $state('')
  let activityTypeFilterInputEl = $state<HTMLInputElement | null>(null)
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

  const filteredActivityTypes = $derived.by(() => {
    const q = activityTypeFilter.trim().toLowerCase()
    if (!q) return activityTypesOptions
    return activityTypesOptions.filter((t) => t.toLowerCase().includes(q))
  })

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
  let isBulkDeleting = $state(false)
  let bulkDeleteProgress = $state(0)
  let currentDeleteIndex = $state(0)
  let totalToDelete = $state(0)
  let eventsToBulkDelete = $state<string[]>([])
  let candidatesSourceEventId = $state<string | null>(null)
  let candidates = $state<EventSummary[]>([])
  let candidatesLoading = $state(false)
  let selectedCandidateIds = $state<Set<string>>(new Set())

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

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement
    const files = target.files
    if (!files || files.length === 0) return

    await handleFiles(Array.from(files))
    target.value = ''
  }

  function handleDragEnter(event: DragEvent) {
    // Only show overlay for file drags, not when uploading
    if (isUploading) return
    
    const types = event.dataTransfer?.types
    if (types && Array.from(types).includes('Files')) {
      event.preventDefault()
      event.stopPropagation()
      isDraggingOver = true
    }
  }

  function handleDragLeave(event: DragEvent) {
    // Only hide overlay if we're actually leaving the dashboard section
    const relatedTarget = event.relatedTarget as Node | null
    const currentTarget = event.currentTarget as HTMLElement
    
    if (!relatedTarget || !currentTarget.contains(relatedTarget)) {
      isDraggingOver = false
    }
  }

  function handleDragOver(event: DragEvent) {
    // Only allow drop for file drags
    const types = event.dataTransfer?.types
    if (types && Array.from(types).includes('Files')) {
      event.preventDefault()
      event.stopPropagation()
      if (!isUploading) {
        isDraggingOver = true
      }
    }
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
    
    isDraggingOver = false

    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return

    await handleFiles(Array.from(files))
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

  async function handleFindComparisonsClick(eventId: string) {
    candidatesSourceEventId = eventId
    candidatesLoading = true
    candidates = []
    selectedCandidateIds = new Set()

    try {
      const found = await getComparisonCandidates(eventId)
      candidates = found
    } catch (error) {
      console.error('Failed to load comparison candidates:', error)
      showToast(error instanceof Error ? error.message : 'Failed to load comparison candidates')
    } finally {
      candidatesLoading = false
    }
  }

  function handleCancelCandidates() {
    candidatesSourceEventId = null
    candidates = []
    selectedCandidateIds = new Set()
  }

  function toggleCandidateSelection(eventId: string) {
    const newSet = new Set(selectedCandidateIds)
    if (newSet.has(eventId)) {
      newSet.delete(eventId)
    } else {
      newSet.add(eventId)
    }
    selectedCandidateIds = newSet
  }

  function handleCompareSelected() {
    if (!candidatesSourceEventId || selectedCandidateIds.size === 0) return

    const eventIds = [candidatesSourceEventId, ...Array.from(selectedCandidateIds)]
    push(`/compare/new?events=${eventIds.join(',')}`)
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

  $effect(() => {
    if (!activityTypeDropdownOpen && !deviceDropdownOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        activityTypeFilter = ''
        activityTypeDropdownOpen = false
        deviceDropdownOpen = false
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  $effect(() => {
    if (activityTypeDropdownOpen && activityTypeFilterInputEl) {
      const t = setTimeout(() => activityTypeFilterInputEl?.focus(), 0)
      return () => clearTimeout(t)
    }
  })

  // Find source event row for candidates modal (may not be on current page)
  const sourceEventRow = $derived.by(() => {
    if (!candidatesSourceEventId) return null
    return activityRowsFromApi.find((row) => row.event.id === candidatesSourceEventId) ?? null
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

  function handleCancelBulkDelete() {
    eventsToBulkDelete = []
  }

  async function handleConfirmBulkDelete() {
    const eventIds = eventsToBulkDelete
    if (eventIds.length === 0) return

    isBulkDeleting = true
    totalToDelete = eventIds.length
    currentDeleteIndex = 0
    bulkDeleteProgress = 0

    let successful = 0
    let failed = 0

    try {
      for (let i = 0; i < eventIds.length; i++) {
        currentDeleteIndex = i
        bulkDeleteProgress = (i / eventIds.length) * 100

        try {
          const deleted = await deleteEvent(eventIds[i])
          if (deleted) {
            successful++
          } else {
            failed++
          }
        } catch (error) {
          console.error(`Failed to delete event ${eventIds[i]}:`, error)
          failed++
        }
      }

      bulkDeleteProgress = 100

      if (successful > 0) {
        showToast(`Deleted ${successful} event${successful > 1 ? 's' : ''} successfully`)
        await loadActivityRows()
      }
      if (failed > 0) {
        showToast(`Failed to delete ${failed} event${failed > 1 ? 's' : ''}`)
      }

      clearSelection()
    } finally {
      isBulkDeleting = false
      eventsToBulkDelete = []
      bulkDeleteProgress = 0
      currentDeleteIndex = 0
      totalToDelete = 0
    }
  }

  function formatDurationCell(stats: Record<string, unknown>): string {
    const found = findStatByMetric(stats, 'Duration') ?? findStatByMetric(stats, 'Moving Time')
    if (!found) return '—'
    return formatStatValue(found.value as number | string | number[] | Record<string, unknown> | null | undefined, found.statType)
  }

  function formatAvgHeartRateCell(stats: Record<string, unknown>): string {
    const found = findStatByMetric(stats, 'Heart Rate', 'Average')
    if (!found) return '—'
    return formatStatValue(found.value as number | string | number[] | Record<string, unknown> | null | undefined, found.statType)
  }

  function formatCaloriesCell(stats: Record<string, unknown>): string {
    const found = findStatByMetric(stats, 'Energy') ?? findStatByMetric(stats, 'Calories')
    if (!found) return '—'
    return formatStatValue(found.value as number | string | number[] | Record<string, unknown> | null | undefined, found.statType)
  }

  function formatDistanceCell(stats: Record<string, unknown>): string {
    const found = findStatByMetric(stats, 'Distance')
    if (!found) return '—'
    return formatStatValue(found.value as number | string | number[] | Record<string, unknown> | null | undefined, found.statType)
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
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  {#if isDraggingOver && !isUploading}
    <DropZoneOverlay visible={isDraggingOver && !isUploading} />
  {/if}

  <h1 class="mb-6 text-2xl font-semibold text-text-primary">Dashboard</h1>

  <!-- Upload Section and Bulk Action Bar -->
  <div class="mb-6 flex items-center justify-between gap-4">
    <label
      for="file-upload"
      class="inline-flex cursor-pointer items-center rounded-md border-0 bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
    >
      <svg
        class="mr-2 h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      Upload Activity Files
    </label>
    <input
      id="file-upload"
      type="file"
      accept=".json,.tcx,.fit,.gpx,.sml"
      multiple
      class="hidden"
      onchange={handleFileSelect}
      disabled={isUploading}
    />

    <!-- Bulk Action Bar -->
    {#if selectedEventIds.size > 0}
      <div class="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 backdrop-blur shadow-sm">
        <p class="text-xs font-medium text-text-primary">
          {selectedEventIds.size} event{selectedEventIds.size > 1 ? 's' : ''} selected
        </p>
        <button
          type="button"
          class="rounded border-2 border-border bg-surface px-1.5 py-0.5 text-xs font-medium text-text-primary shadow-sm hover:bg-card-hover hover:border-text-secondary focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
          onclick={clearSelection}
          disabled={isBulkDeleting || isDeleting}
        >
          Clear
        </button>
        <button
          type="button"
          class="flex items-center rounded border-0 bg-accent px-1.5 py-0.5 text-xs font-medium text-white shadow-sm hover:bg-accent-hover focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
          onclick={() => {
            if (selectedEventIds.size >= 2) {
              push(`/compare/new?events=${Array.from(selectedEventIds).join(',')}`)
            }
          }}
          disabled={selectedEventIds.size < 2 || isBulkDeleting || isDeleting}
        >
          <span class="material-icons text-sm leading-none mr-0.5" aria-hidden="true">compare_arrows</span>
          Compare
        </button>
        <button
          type="button"
          class="flex items-center rounded border-0 bg-danger px-1.5 py-0.5 text-xs font-medium text-white shadow-sm hover:bg-danger-hover focus:outline-none focus:ring-1 focus:ring-danger disabled:opacity-50"
          onclick={handleBulkDeleteClick}
          disabled={isBulkDeleting || isDeleting}
        >
          <span class="material-icons text-sm leading-none mr-0.5" aria-hidden="true">delete</span>
          Delete
        </button>
      </div>
    {/if}
  </div>

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

  <!-- Bulk Delete Progress Bar -->
  {#if isBulkDeleting}
    <UploadProgressBar
      currentFile={currentDeleteIndex + 1}
      totalFiles={totalToDelete}
      progress={bulkDeleteProgress}
      label="Deleting event"
      progressColor="bg-danger"
    />
  {/if}

  <!-- Toast Notification -->
  {#if toastMessage}
    <div
      class="mb-4 rounded-md border border-border bg-card p-4 backdrop-blur"
      role="alert"
    >
      <p class="text-sm font-medium text-text-primary">{toastMessage}</p>
    </div>
  {/if}

  <!-- Filter bar (elevated when dropdowns open so they appear above the table) -->
  <div
    class="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 backdrop-blur"
    class:relative={activityTypeDropdownOpen || deviceDropdownOpen}
    class:z-30={activityTypeDropdownOpen || deviceDropdownOpen}
  >
    <label class="sr-only" for="filter-search">Search</label>
    <input
      id="filter-search"
      type="text"
      bind:value={searchInputValue}
      oninput={onSearchInput}
      placeholder="Search…"
      class="min-w-[12rem] rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    />
    <div class="relative">
      <button
        type="button"
        onclick={() => {
          deviceDropdownOpen = false
          if (!activityTypeDropdownOpen) activityTypeFilter = ''
          activityTypeDropdownOpen = !activityTypeDropdownOpen
        }}
        class="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary hover:bg-card-hover focus:outline-none focus:ring-1 focus:ring-accent"
        aria-expanded={activityTypeDropdownOpen}
        aria-haspopup="listbox"
      >
        Activity type {selectedActivityTypes.length ? `(${selectedActivityTypes.length})` : ''}
        <span class="material-icons ml-1 text-sm">arrow_drop_down</span>
      </button>
      {#if activityTypeDropdownOpen}
        <div
          class="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border bg-card-solid shadow-lg"
          role="listbox"
        >
          <div class="sticky top-0 z-10 border-b border-border bg-card-solid p-2">
            <label for="activity-type-filter" class="sr-only">Filter activity types</label>
            <input
              id="activity-type-filter"
              type="text"
              bind:value={activityTypeFilter}
              placeholder="Search…"
              class="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              onkeydown={(e) => e.stopPropagation()}
              bind:this={activityTypeFilterInputEl}
            />
          </div>
          <div class="max-h-60 overflow-auto py-1">
            {#each filteredActivityTypes as type}
              <label class="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-card-hover">
                <input
                  type="checkbox"
                  checked={selectedActivityTypes.includes(type)}
                  onchange={() => toggleActivityType(type)}
                  class="h-4 w-4 rounded border-border text-accent"
                />
                <span class="text-sm text-text-primary">{type}</span>
              </label>
            {/each}
            {#if filteredActivityTypes.length === 0}
              <p class="px-3 py-2 text-sm text-text-secondary">No matching types</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
    <div class="relative">
      <button
        type="button"
        onclick={() => { deviceDropdownOpen = !deviceDropdownOpen; activityTypeDropdownOpen = false }}
        class="inline-flex items-center rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text-primary hover:bg-card-hover focus:outline-none focus:ring-1 focus:ring-accent"
        aria-expanded={deviceDropdownOpen}
        aria-haspopup="listbox"
      >
        Device {selectedDevices.length ? `(${selectedDevices.length})` : ''}
        <span class="material-icons ml-1 text-sm">arrow_drop_down</span>
      </button>
      {#if deviceDropdownOpen}
        <div
          class="absolute left-0 top-full z-20 mt-1 max-h-60 w-56 overflow-auto rounded-md border border-border bg-card-solid py-1 shadow-lg"
          role="listbox"
        >
          {#each devicesOptions as device}
            <label class="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-card-hover">
              <input
                type="checkbox"
                checked={selectedDevices.includes(device)}
                onchange={() => toggleDevice(device)}
                class="h-4 w-4 rounded border-border text-accent"
              />
              <span class="text-sm text-text-primary">{device}</span>
            </label>
          {/each}
        </div>
      {/if}
    </div>
    {#if activityTypeDropdownOpen || deviceDropdownOpen}
      <div
        class="fixed inset-0 z-10"
        role="presentation"
        onclick={() => {
          activityTypeFilter = ''
          activityTypeDropdownOpen = false
          deviceDropdownOpen = false
        }}
      ></div>
    {/if}
    <div class="flex items-center gap-2">
      <label for="filter-date-start" class="text-sm text-text-secondary">From</label>
      <input
        id="filter-date-start"
        type="date"
        value={dateStartStr}
        onchange={(e) => setDateStart((e.target as HTMLInputElement).value)}
        class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <label for="filter-date-end" class="text-sm text-text-secondary">To</label>
      <input
        id="filter-date-end"
        type="date"
        value={dateEndStr}
        onchange={(e) => setDateEnd((e.target as HTMLInputElement).value)}
        class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  </div>

  <!-- Pagination (above table) -->
  {#if totalRows > 0}
    <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <label for="page-size-select" class="text-sm text-text-secondary">Per page</label>
        <select
          id="page-size-select"
          value={pageSize}
          onchange={onPageSizeChange}
          class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {#each PAGE_SIZE_OPTIONS as size}
            <option value={size}>{size}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPageFromUrl <= 1}
          onclick={() => goToPage(currentPageFromUrl - 1)}
          class="inline-flex h-9 w-9 items-center justify-center rounded-[28%] border border-border bg-surface text-text-primary hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:pointer-events-none"
          aria-label="Previous page"
        >
          <span class="material-icons text-lg">chevron_left</span>
        </button>
        {#each visiblePageNumbers as p, i}
          {#if i > 0 && p - (visiblePageNumbers[i - 1] ?? 0) > 1}
            <span class="px-1 text-text-secondary">…</span>
          {/if}
          <button
            type="button"
            onclick={() => goToPage(p)}
            class="inline-flex h-9 w-9 items-center justify-center rounded-[28%] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent {p === currentPageFromUrl
              ? 'border-0 bg-accent text-white'
              : 'border border-border bg-surface text-text-primary hover:bg-card-hover'}"
            aria-label="Page {p}"
            aria-current={p === currentPageFromUrl ? 'page' : undefined}
          >
            {p}
          </button>
        {/each}
        <button
          type="button"
          disabled={currentPageFromUrl >= totalPages}
          onclick={() => goToPage(currentPageFromUrl + 1)}
          class="inline-flex h-9 w-9 items-center justify-center rounded-[28%] border border-border bg-surface text-text-primary hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:pointer-events-none"
          aria-label="Next page"
        >
          <span class="material-icons text-lg">chevron_right</span>
        </button>
        <span class="text-sm text-text-secondary">{pageRangeText}</span>
        <label for="jump-to-page" class="sr-only">Jump to page</label>
        <select
          id="jump-to-page"
          value={currentPageFromUrl}
          onchange={(e) => goToPage(Number((e.target as HTMLSelectElement).value))}
          class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Page {currentPageFromUrl} of {totalPages}"
        >
          {#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
            <option value={p}>Page {p} of {totalPages}</option>
          {/each}
        </select>
      </div>
    </div>
  {/if}

  <!-- Activity list table (text 15% larger: 0.75rem→0.8625rem, 0.875rem→1.00625rem) -->
  <div class="overflow-hidden rounded-lg border border-border bg-card shadow backdrop-blur-lg">
    <table class="w-full divide-y divide-border text-[1.00625rem] table-fixed">
      <thead class="bg-surface">
        <tr>
          <th scope="col" class="relative w-12 px-3 py-3">
            <input
              type="checkbox"
              bind:this={selectAllCheckbox}
              class="h-4 w-4 rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
              checked={selectAllChecked}
              onchange={toggleSelectAll}
              aria-label="Select all events"
            />
          </th>
          <th
            scope="col"
            class="px-3 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary w-1/4"
          >
            Activity
          </th>
          <th
            scope="col"
            class="px-3 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary w-20"
          >
            Duration
          </th>
          <th
            scope="col"
            class="px-3 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary w-24"
          >
            Avg HR
          </th>
          <th
            scope="col"
            class="px-3 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary w-20"
          >
            Calories
          </th>
          <th
            scope="col"
            class="px-3 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary w-24"
          >
            Distance
          </th>
          <th
            scope="col"
            class="px-3 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary w-32"
          >
            Date
          </th>
          <th scope="col" class="relative px-3 py-3 w-48">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border bg-transparent">
        {#if activityRowsFromApi.length === 0 && !isLoading}
          <tr>
            <td colspan="8" class="px-6 py-4 text-center text-text-secondary">
              No activities found. Upload an activity file or adjust filters.
            </td>
          </tr>
        {:else}
          {#each activityRowsFromApi as row (`${row.event.id}_${row.activity.id}`)}
            {@const isSelected = selectedEventIds.has(row.event.id)}
            <tr
              role="link"
              tabindex="0"
              class="hover:bg-card-hover"
              class:cursor-pointer={!isLoading}
              class:bg-card-hover={isSelected}
              onclick={() => {
                if (!isLoading) push(`/event/${row.event.id}`)
              }}
              onkeydown={(e) => {
                if (!isLoading && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  push(`/event/${row.event.id}`)
                }
              }}
            >
              <td class="px-3 py-4" onclick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  class="h-4 w-4 rounded border-border text-accent focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                  checked={isSelected}
                  onchange={() => toggleEventSelection(row.event.id)}
                  aria-label={`Select event ${row.event.name || row.event.id}`}
                  onclick={(e) => e.stopPropagation()}
                />
              </td>
              <td class="px-3 py-4">
                <div class="flex items-center gap-2 min-w-0">
                  <span
                  class="material-icons shrink-0 inline-flex items-center justify-center text-text-secondary"
                  style="font-size: 3rem; width: 3rem; height: 3rem; line-height: 1;"
                  aria-hidden="true"
                  >{getActivityIcon(row.activity.type)}</span
                >
                  <div class="min-w-0 flex flex-col gap-0.5 flex-1">
                    <span class="font-medium text-text-primary truncate">{row.activity.type || '—'}</span>
                    <span class="text-text-secondary text-sm truncate">
                      {getActivityDeviceName(row.activity)}
                    </span>
                    <span class="text-text-secondary text-sm truncate" title={row.event.name || undefined}>
                      {row.event.name || '—'}
                    </span>
                  </div>
                </div>
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-text-secondary">
                {formatDurationCell(row.activity.stats)}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-text-secondary">
                {formatAvgHeartRateCell(row.activity.stats)}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-text-secondary">
                {formatCaloriesCell(row.activity.stats)}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-text-secondary">
                {formatDistanceCell(row.activity.stats)}
              </td>
              <td class="whitespace-nowrap px-3 py-4 text-text-secondary text-sm">
                {formatDateWithTime(row.activity.startDate ?? row.event.startDate)}
              </td>
              <td class="px-3 py-4 text-right font-medium">
                <div class="flex items-center justify-end gap-1.5 flex-wrap">
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                    onclick={(e) => {
                      e.stopPropagation()
                      push(`/event/${row.event.id}`)
                    }}
                  >
                    <span class="material-icons text-base leading-none" aria-hidden="true">search</span>
                    View
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-accent/30 bg-card px-2 text-xs font-medium text-accent shadow-sm hover:bg-accent/10 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                    onclick={(e) => {
                      e.stopPropagation()
                      handleFindComparisonsClick(row.event.id)
                    }}
                  >
                    <span class="material-icons text-base leading-none" aria-hidden="true">compare_arrows</span>
                    Find
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-danger/30 bg-card px-2 text-xs font-medium text-danger shadow-sm hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-transparent"
                    onclick={(e) => handleDeleteClick(row.event.id, e)}
                  >
                    <span class="material-icons text-base leading-none" aria-hidden="true">delete</span>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  <!-- Pagination (below table) -->
  {#if totalRows > 0}
    <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <label for="page-size-select-bottom" class="text-sm text-text-secondary">Per page</label>
        <select
          id="page-size-select-bottom"
          value={pageSize}
          onchange={onPageSizeChange}
          class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {#each PAGE_SIZE_OPTIONS as size}
            <option value={size}>{size}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPageFromUrl <= 1}
          onclick={() => goToPage(currentPageFromUrl - 1)}
          class="inline-flex h-9 w-9 items-center justify-center rounded-[28%] border border-border bg-surface text-text-primary hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:pointer-events-none"
          aria-label="Previous page"
        >
          <span class="material-icons text-lg">chevron_left</span>
        </button>
        {#each visiblePageNumbers as p, i}
          {#if i > 0 && p - (visiblePageNumbers[i - 1] ?? 0) > 1}
            <span class="px-1 text-text-secondary">…</span>
          {/if}
          <button
            type="button"
            onclick={() => goToPage(p)}
            class="inline-flex h-9 w-9 items-center justify-center rounded-[28%] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent {p === currentPageFromUrl
              ? 'border-0 bg-accent text-white'
              : 'border border-border bg-surface text-text-primary hover:bg-card-hover'}"
            aria-label="Page {p}"
            aria-current={p === currentPageFromUrl ? 'page' : undefined}
          >
            {p}
          </button>
        {/each}
        <button
          type="button"
          disabled={currentPageFromUrl >= totalPages}
          onclick={() => goToPage(currentPageFromUrl + 1)}
          class="inline-flex h-9 w-9 items-center justify-center rounded-[28%] border border-border bg-surface text-text-primary hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:pointer-events-none"
          aria-label="Next page"
        >
          <span class="material-icons text-lg">chevron_right</span>
        </button>
        <span class="text-sm text-text-secondary">{pageRangeText}</span>
        <label for="jump-to-page-bottom" class="sr-only">Jump to page</label>
        <select
          id="jump-to-page-bottom"
          value={currentPageFromUrl}
          onchange={(e) => goToPage(Number((e.target as HTMLSelectElement).value))}
          class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          aria-label="Page {currentPageFromUrl} of {totalPages}"
        >
          {#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
            <option value={p}>Page {p} of {totalPages}</option>
          {/each}
        </select>
      </div>
    </div>
  {/if}

  <!-- Single Delete Confirmation Dialog -->
  {#if eventToDelete}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onclick={handleCancelDelete}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div
        class="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl backdrop-blur-xl"
        onclick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-title" class="mb-4 text-lg font-semibold text-text-primary">
          Delete Event?
        </h2>
        <p class="mb-6 text-sm text-text-secondary">
          Are you sure you want to delete this event? This action cannot be undone.
        </p>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50"
            onclick={handleCancelDelete}
            disabled={isDeleting || isBulkDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md border-0 bg-danger px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-danger-hover focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50"
            onclick={handleConfirmDelete}
            disabled={isDeleting || isBulkDeleting}
          >
            {#if isDeleting}
              Deleting...
            {:else}
              Delete
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Bulk Delete Confirmation Dialog -->
  {#if eventsToBulkDelete.length > 0}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onclick={handleCancelBulkDelete}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-dialog-title"
    >
      <div
        class="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl backdrop-blur-xl"
        onclick={(e) => e.stopPropagation()}
      >
        <h2 id="bulk-dialog-title" class="mb-4 text-lg font-semibold text-text-primary">
          Delete {eventsToBulkDelete.length} Event{eventsToBulkDelete.length > 1 ? 's' : ''}?
        </h2>
        <p class="mb-6 text-sm text-text-secondary">
          Are you sure you want to delete {eventsToBulkDelete.length} event{eventsToBulkDelete.length > 1 ? 's' : ''}? This action cannot be undone.
        </p>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50"
            onclick={handleCancelBulkDelete}
            disabled={isBulkDeleting || isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md border-0 bg-danger px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-danger-hover focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50"
            onclick={handleConfirmBulkDelete}
            disabled={isBulkDeleting || isDeleting}
          >
            {#if isBulkDeleting}
              Deleting...
            {:else}
              Delete {eventsToBulkDelete.length} Event{eventsToBulkDelete.length > 1 ? 's' : ''}
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Candidates Modal -->
  {#if candidatesSourceEventId}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onclick={handleCancelCandidates}
      role="dialog"
      aria-modal="true"
    >
      <div
        class="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-lg border border-border bg-surface shadow-xl backdrop-blur-xl flex flex-col"
        onclick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between border-b border-border p-6">
          <div class="flex-1">
            <h2 class="text-lg font-semibold text-text-primary mb-3">Find Comparison Candidates</h2>
            {#if sourceEventRow}
              <div class="flex items-center gap-3">
                <span
                  class="material-icons shrink-0 inline-flex items-center justify-center text-text-secondary"
                  style="font-size: 2.5rem; width: 2.5rem; height: 2.5rem; line-height: 1;"
                  aria-hidden="true"
                >{getActivityIcon(sourceEventRow.activity.type)}</span>
                <div class="min-w-0 flex flex-col gap-0.5">
                  <span class="font-medium text-text-primary">{sourceEventRow.activity.type || '—'}</span>
                  <span class="text-text-secondary text-sm">
                    {getActivityDeviceName(sourceEventRow.activity)}
                  </span>
                  <span class="text-text-secondary text-sm truncate" title={sourceEventRow.event.name || undefined}>
                    {sourceEventRow.event.name || '—'}
                  </span>
                  <span class="text-text-secondary text-sm">
                    {formatDateWithTime(sourceEventRow.activity.startDate ?? sourceEventRow.event.startDate)}
                  </span>
                </div>
              </div>
            {/if}
          </div>
          <button
            type="button"
            class="rounded p-1 text-text-secondary hover:bg-card-hover hover:text-text-primary ml-4"
            onclick={handleCancelCandidates}
            aria-label="Close"
          >
            <span class="material-icons">close</span>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          {#if candidatesLoading}
            <div class="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          {:else if candidates.length === 0}
            <p class="text-sm text-text-secondary text-center py-8">
              No overlapping events found for comparison.
            </p>
          {:else}
            <p class="mb-4 text-sm text-text-secondary">
              Select events that overlap in time with this event to compare:
            </p>
            <div class="space-y-2">
              {#each candidates as candidate (candidate.id)}
                {@const isSelected = selectedCandidateIds.has(candidate.id)}
                {@const candidateActivity = candidate.activities?.[0]}
                <label
                  class="flex items-center gap-3 rounded border border-border bg-card p-3 cursor-pointer hover:bg-card-hover {isSelected ? 'border-accent bg-accent/10' : ''}"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-border text-accent focus:ring-2 focus:ring-accent"
                    checked={isSelected}
                    onchange={() => toggleCandidateSelection(candidate.id)}
                  />
                  <span
                    class="material-icons shrink-0 inline-flex items-center justify-center text-text-secondary"
                    style="font-size: 2.5rem; width: 2.5rem; height: 2.5rem; line-height: 1;"
                    aria-hidden="true"
                  >{getActivityIcon(candidateActivity?.type)}</span>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-text-primary">{candidateActivity?.type || '—'}</div>
                    <div class="text-sm text-text-secondary">
                      {getActivityDeviceName(candidateActivity || {})}
                    </div>
                    <div class="text-sm text-text-secondary truncate" title={candidate.name || undefined}>
                      {candidate.name || '—'}
                    </div>
                    <div class="text-sm text-text-secondary">
                      {formatDateWithTime(candidateActivity?.startDate ?? candidate.startDate)}
                    </div>
                  </div>
                </label>
              {/each}
            </div>
          {/if}
        </div>

        <div class="flex items-center justify-end gap-3 border-t border-border p-6">
          <button
            type="button"
            class="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover"
            onclick={handleCancelCandidates}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md border-0 bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-hover disabled:opacity-50"
            onclick={handleCompareSelected}
            disabled={selectedCandidateIds.size === 0}
          >
            Compare ({selectedCandidateIds.size + 1} event{selectedCandidateIds.size + 1 > 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  {/if}
</section>
