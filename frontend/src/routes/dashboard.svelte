<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from 'svelte-spa-router'
  import { getEvents, uploadFile } from '../lib/api'
  import type { EventSummary } from '../lib/types'
  import { formatDateShort } from '../lib/utils'

  let events = $state<EventSummary[]>([])
  let isLoading = $state(false)
  let isUploading = $state(false)
  let toastMessage = $state<string | null>(null)
  let toastTimeout: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    toastMessage = message
    if (toastTimeout) clearTimeout(toastTimeout)
    toastTimeout = setTimeout(() => {
      toastMessage = null
      toastTimeout = null
    }, 5000)
  }

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

  onMount(() => {
    loadEvents()
  })
</script>

<section class="p-6">
  <h1 class="mb-6 text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>

  <!-- Upload Section -->
  <div class="mb-6">
    <label
      for="file-upload"
      class="inline-flex cursor-pointer items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
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
    <div class="mb-4 flex items-center justify-center">
      <svg
        class="h-8 w-8 animate-spin text-blue-600"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </div>
  {/if}

  <!-- Toast Notification -->
  {#if toastMessage}
    <div
      class="mb-4 rounded-md bg-blue-50 p-4 dark:bg-blue-900/20"
      role="alert"
    >
      <p class="text-sm font-medium text-blue-800 dark:text-blue-200">{toastMessage}</p>
    </div>
  {/if}

  <!-- Events Table -->
  <div class="overflow-hidden rounded-lg border border-gray-200 shadow dark:border-gray-700">
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead class="bg-gray-50 dark:bg-gray-800">
        <tr>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Name
          </th>
          <th
            scope="col"
            class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
          >
            Date
          </th>
          <th scope="col" class="relative px-6 py-3">
            <span class="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
        {#if events.length === 0 && !isLoading}
          <tr>
            <td colspan="3" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
              No events found. Upload an activity file to get started.
            </td>
          </tr>
        {:else}
          {#each events as event (event.id)}
            <tr
              class="hover:bg-gray-50 dark:hover:bg-gray-800"
              class:cursor-pointer={!isLoading}
              onclick={() => {
                if (!isLoading) push(`/event/${event.id}`)
              }}
            >
              <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                {event.name || 'Untitled'}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                {formatDateShort(event.startDate)}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                <button
                  type="button"
                  class="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                  onclick={(e) => {
                    e.stopPropagation()
                    push(`/event/${event.id}`)
                  }}
                >
                  View
                </button>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</section>
