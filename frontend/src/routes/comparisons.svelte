<script lang="ts">
  import { onMount } from 'svelte'
  import { push } from 'svelte-spa-router'
  import { getComparisons, deleteComparison } from '../lib/api'
  import type { Comparison } from '../lib/types'
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte'

  let comparisons = $state<Comparison[]>([])
  let isLoading = $state(true)
  let error = $state<string | null>(null)
  let comparisonToDelete = $state<string | null>(null)
  let isDeleting = $state(false)

  async function loadComparisons() {
    isLoading = true
    error = null
    try {
      comparisons = await getComparisons()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load comparisons'
      comparisons = []
    } finally {
      isLoading = false
    }
  }

  function handleDeleteClick(id: string) {
    comparisonToDelete = id
  }

  function handleCancelDelete() {
    comparisonToDelete = null
  }

  async function handleConfirmDelete() {
    if (!comparisonToDelete) return

    isDeleting = true
    try {
      await deleteComparison(comparisonToDelete)
      await loadComparisons()
      comparisonToDelete = null
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete comparison'
    } finally {
      isDeleting = false
    }
  }

  function formatDate(date: number | undefined): string {
    if (!date) return ''
    return new Date(date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  onMount(() => {
    loadComparisons()
  })
</script>

<section class="mx-auto w-[85%] max-w-screen-2xl py-6">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-semibold text-text-primary">Saved Comparisons</h1>
  </div>

  {#if isLoading}
    <div class="flex justify-center py-12">
      <LoadingSpinner />
    </div>
  {:else if error}
    <div class="rounded-md border border-danger/20 bg-danger/10 p-4 backdrop-blur">
      <p class="text-sm font-medium text-danger">{error}</p>
    </div>
  {:else if comparisons.length === 0}
    <div class="rounded-md border border-border bg-card p-8 text-center backdrop-blur">
      <p class="text-sm font-medium text-text-primary">No saved comparisons yet.</p>
      <p class="mt-2 text-xs text-text-secondary">
        Create a comparison from the dashboard to save it here.
      </p>
    </div>
  {:else}
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
              Events
            </th>
            <th
              scope="col"
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
            >
              Created
            </th>
            <th scope="col" class="relative px-6 py-3">
              <span class="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border bg-transparent">
          {#each comparisons as comparison (comparison.id)}
            <tr
              role="link"
              tabindex="0"
              class="hover:bg-card-hover cursor-pointer"
              onclick={() => push(`/compare/${comparison.id}`)}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  push(`/compare/${comparison.id}`)
                }
              }}
            >
              <td class="px-6 py-4">
                <div class="font-medium text-text-primary">{comparison.name}</div>
              </td>
              <td class="px-6 py-4 text-text-secondary">
                {comparison.eventIds.length} event{comparison.eventIds.length > 1 ? 's' : ''}
              </td>
              <td class="px-6 py-4 text-text-secondary">{formatDate(comparison.createdAt)}</td>
              <td class="whitespace-nowrap px-6 py-4 text-right font-medium">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent"
                    onclick={(e) => {
                      e.stopPropagation()
                      push(`/compare/${comparison.id}`)
                    }}
                  >
                    <span class="material-icons text-[1.15em] leading-none" aria-hidden="true">search</span>
                    View
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-danger/30 bg-card px-3 font-medium text-danger shadow-sm hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger"
                    onclick={(e) => {
                      e.stopPropagation()
                      handleDeleteClick(comparison.id)
                    }}
                  >
                    <span class="material-icons text-[1.15em] leading-none" aria-hidden="true">delete</span>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Delete Confirmation Dialog -->
  {#if comparisonToDelete}
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onclick={handleCancelDelete}
      role="dialog"
      aria-modal="true"
    >
      <div
        class="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-xl backdrop-blur-xl"
        onclick={(e) => e.stopPropagation()}
      >
        <h2 class="mb-4 text-lg font-semibold text-text-primary">Delete Comparison?</h2>
        <p class="mb-6 text-sm text-text-secondary">
          Are you sure you want to delete this comparison? This action cannot be undone.
        </p>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            onclick={handleCancelDelete}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            class="rounded-md border-0 bg-danger px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-danger-hover focus:outline-none focus:ring-2 focus:ring-danger disabled:opacity-50"
            onclick={handleConfirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</section>
