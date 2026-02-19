<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from 'svelte-spa-router'
  import { getEvents, uploadFile, deleteEvent } from '../lib/api'
  import type { EventSummary, Activity } from '../lib/types'
  import {
    formatDateShort,
    getActivityIcon,
    findStatByMetric,
    formatStatValue,
    getActivityDeviceName,
  } from '../lib/utils'
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte'
  import UploadProgressBar from '../lib/components/UploadProgressBar.svelte'
  import DropZoneOverlay from '../lib/components/DropZoneOverlay.svelte'

  let events = $state<EventSummary[]>([])
  let isLoading = $state(false)
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

  async function loadEvents() {
    isLoading = true
    try {
      events = await getEvents({ limit: 200 })
    } catch (error) {
      console.error('Failed to load events:', error)
      showToast(error instanceof Error ? error.message : 'Failed to load events')
    } finally {
      isLoading = false
    }
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
        await loadEvents() // Refresh the list
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
        await loadEvents() // Refresh the list
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
    loadEvents()
  })

  type ActivityRow = { activity: Activity | { id: string; eventID: string; startDate?: number; type?: string; stats: Record<string, unknown> }; event: EventSummary }

  const activityRows = $derived.by((): ActivityRow[] => {
    const rows: ActivityRow[] = []
    for (const ev of events) {
      const activities = ev.activities ?? []
      if (activities.length > 0) {
        for (const a of activities) {
          rows.push({ activity: a, event: ev })
        }
      } else {
        rows.push({
          activity: {
            id: ev.id,
            eventID: ev.id,
            startDate: ev.startDate,
            stats: {},
          },
          event: ev,
        })
      }
    }
    rows.sort((a, b) => {
      const dateA = a.activity.startDate ?? a.event.startDate ?? 0
      const dateB = b.activity.startDate ?? b.event.startDate ?? 0
      return dateB - dateA
    })
    return rows
  })

  function formatDurationCell(stats: Record<string, unknown>): string {
    const found = findStatByMetric(stats, 'Duration') ?? findStatByMetric(stats, 'Moving Time')
    if (!found) return '—'
    return formatStatValue(found.value, found.statType)
  }

  function formatAvgHeartRateCell(stats: Record<string, unknown>): string {
    const found = findStatByMetric(stats, 'Heart Rate', 'Average')
    if (!found) return '—'
    return formatStatValue(found.value, found.statType)
  }

  function formatCaloriesCell(stats: Record<string, unknown>): string {
    const found = findStatByMetric(stats, 'Energy') ?? findStatByMetric(stats, 'Calories')
    if (!found) return '—'
    return formatStatValue(found.value, found.statType)
  }

  function formatDistanceCell(stats: Record<string, unknown>): string {
    const found = findStatByMetric(stats, 'Distance')
    if (!found) return '—'
    return formatStatValue(found.value, found.statType)
  }

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

  <!-- Upload Section -->
  <div class="mb-6">
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

  <!-- Toast Notification -->
  {#if toastMessage}
    <div
      class="mb-4 rounded-md border border-border bg-card p-4 backdrop-blur"
      role="alert"
    >
      <p class="text-sm font-medium text-text-primary">{toastMessage}</p>
    </div>
  {/if}

  <!-- Activity list table (text 15% larger: 0.75rem→0.8625rem, 0.875rem→1.00625rem) -->
  <div class="overflow-hidden rounded-lg border border-border bg-card shadow backdrop-blur-lg">
    <table class="min-w-full divide-y divide-border text-[1.00625rem]">
      <thead class="bg-surface">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary"
          >
            Activity
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary"
          >
            Duration
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary"
          >
            Average heart rate
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary"
          >
            Calories
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary"
          >
            Distance
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-[0.8625rem] font-medium uppercase tracking-wider text-text-secondary"
          >
            Date
          </th>
          <th scope="col" class="relative px-6 py-3">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border bg-transparent">
        {#if activityRows.length === 0 && !isLoading}
          <tr>
            <td colspan="7" class="px-6 py-4 text-center text-text-secondary">
              No events found. Upload an activity file to get started.
            </td>
          </tr>
        {:else}
          {#each activityRows as row (`${row.event.id}_${row.activity.id}`)}
            <tr
              role="link"
              tabindex="0"
              class="hover:bg-card-hover"
              class:cursor-pointer={!isLoading}
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
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <span
                  class="material-icons shrink-0 inline-flex items-center justify-center text-text-secondary"
                  style="font-size: 4rem; width: 4rem; height: 4rem; line-height: 1;"
                  aria-hidden="true"
                  >{getActivityIcon(row.activity.type)}</span
                >
                  <div class="min-w-0 flex flex-col gap-0.5">
                    <span class="font-medium text-text-primary">{row.activity.type || '—'}</span>
                    <span class="text-text-secondary">
                      {getActivityDeviceName(row.activity)}
                    </span>
                    <span class="text-text-secondary truncate" title={row.event.name || undefined}>
                      {row.event.name || '—'}
                    </span>
                  </div>
                </div>
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-text-secondary">
                {formatDurationCell(row.activity.stats)}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-text-secondary">
                {formatAvgHeartRateCell(row.activity.stats)}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-text-secondary">
                {formatCaloriesCell(row.activity.stats)}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-text-secondary">
                {formatDistanceCell(row.activity.stats)}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-text-secondary">
                {formatDateShort(row.activity.startDate ?? row.event.startDate)}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-right font-medium">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                    onclick={(e) => {
                      e.stopPropagation()
                      push(`/event/${row.event.id}`)
                    }}
                  >
                    <span class="material-icons text-[1.15em] leading-none" style="vertical-align: -0.2em;" aria-hidden="true">search</span>
                    View
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-danger/30 bg-card px-3 font-medium text-danger shadow-sm hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-transparent"
                    onclick={(e) => handleDeleteClick(row.event.id, e)}
                  >
                    <span class="material-icons text-[1.15em] leading-none" style="vertical-align: -0.2em;" aria-hidden="true">delete</span>
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

  <!-- Delete Confirmation Dialog -->
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
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md border-0 bg-danger px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-danger-hover focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50"
            onclick={handleConfirmDelete}
            disabled={isDeleting}
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
</section>
