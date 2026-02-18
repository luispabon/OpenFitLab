<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from 'svelte-spa-router'
  import { getEvents, uploadFile, deleteEvent } from '../lib/api'
  import type { EventSummary } from '../lib/types'
  import { formatDateShort } from '../lib/utils'
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte'

  let events = $state<EventSummary[]>([])
  let isLoading = $state(false)
  let isUploading = $state(false)
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

  async function handleDrop(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()

    const files = event.dataTransfer?.files
    if (!files || files.length === 0) return

    await handleFiles(Array.from(files))
  }

  async function handleFiles(fileList: File[]) {
    isUploading = true
    let successful = 0
    let failed = 0

    try {
      for (const file of fileList) {
        try {
          await uploadFile(file)
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
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault()
    event.stopPropagation()
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
</script>

<section class="mx-auto w-[85%] max-w-screen-2xl py-6">
  <h1 class="mb-6 text-2xl font-semibold text-text-primary">Dashboard</h1>

  <!-- Upload Section -->
  <div class="mb-6">
    <label
      for="file-upload"
      class="inline-flex cursor-pointer items-center rounded-md border-0 bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
      ondrop={handleDrop}
      ondragover={handleDragOver}
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
      Upload Activity File
    </label>
    <input
      id="file-upload"
      type="file"
      accept=".json,.tcx,.fit,.gpx,.sml"
      class="hidden"
      onchange={handleFileSelect}
      disabled={isUploading}
    />
  </div>

  <!-- Loading Spinner -->
  {#if isLoading || isUploading}
    <div class="mb-4">
      <LoadingSpinner />
    </div>
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

  <!-- Events Table -->
  <div class="overflow-hidden rounded-lg border border-border bg-card shadow backdrop-blur-lg">
    <table class="min-w-full divide-y divide-border">
      <thead class="bg-surface">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
          >
            Name
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
          >
            Date
          </th>
          <th scope="col" class="relative px-6 py-3">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-border bg-transparent">
        {#if events.length === 0 && !isLoading}
          <tr>
            <td colspan="3" class="px-6 py-4 text-center text-sm text-text-secondary">
              No events found. Upload an activity file to get started.
            </td>
          </tr>
        {:else}
          {#each events as event (event.id)}
            <tr
              role="link"
              tabindex="0"
              class="hover:bg-card-hover"
              class:cursor-pointer={!isLoading}
              onclick={() => {
                if (!isLoading) push(`/event/${event.id}`)
              }}
              onkeydown={(e) => {
                if (!isLoading && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  push(`/event/${event.id}`)
                }
              }}
            >
              <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-text-primary">
                {event.name || 'Untitled'}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-sm text-text-secondary">
                {formatDateShort(event.startDate)}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-transparent"
                    onclick={(e) => {
                      e.stopPropagation()
                      push(`/event/${event.id}`)
                    }}
                  >
                    <svg
                      class="h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    View
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-card px-3 py-1.5 text-sm font-medium text-danger shadow-sm hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 focus:ring-offset-transparent"
                    onclick={(e) => handleDeleteClick(event.id, e)}
                  >
                    <svg
                      class="h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
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
