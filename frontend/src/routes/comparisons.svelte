<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { getComparisons, deleteComparison, updateComparisonFolder } from '../lib/api';
  import { foldersState, getFolderFromHash } from '../lib/stores/folders.svelte';
  import type { Comparison } from '../lib/types';
  import LoadingSpinner from '../lib/components/LoadingSpinner.svelte';
  import ConfirmDialog from '../lib/components/workouts/ConfirmDialog.svelte';
  import SearchableSelect from '../lib/components/SearchableSelect.svelte';

  let comparisons = $state<Comparison[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let comparisonToDelete = $state<string | null>(null);
  let isDeleting = $state(false);
  let editingComparisonId = $state<string | null>(null);
  let editingError = $state<string | null>(null);

  // Derived state for folder tabs (use current hash so ?folder= is respected on this route)
  const activeFolderId = $derived(getFolderFromHash(foldersState.currentHash));

  const pinnedFolders = $derived(
    [...foldersState.folders].filter((f) => f.pinned).sort((a, b) => a.name.localeCompare(b.name))
  );

  const unpinnedFolders = $derived(
    [...foldersState.folders].filter((f) => !f.pinned).sort((a, b) => a.name.localeCompare(b.name))
  );

  const folderNameById = $derived.by(() => {
    const map = new Map<string, string>();
    for (const f of foldersState.folders) {
      map.set(f.id, f.name);
    }
    return map;
  });

  /** Build href for comparisons page folder tab (keeps user on /comparisons). */
  function comparisonsFolderHref(folderId: 'all' | 'unfiled' | string): string {
    if (folderId === 'all') return '#/comparisons';
    return `#/comparisons?folder=${encodeURIComponent(folderId)}`;
  }

  function isFolderActive(value: 'all' | 'unfiled' | string): boolean {
    return activeFolderId === value;
  }

  const pageTitle = $derived(
    activeFolderId === 'all'
      ? 'Saved Comparisons'
      : activeFolderId === 'unfiled'
        ? 'Unfiled Comparisons'
        : (() => {
            const folder = foldersState.folders.find((f) => f.id === activeFolderId);
            return folder ? `${folder.name} - Comparisons` : 'Saved Comparisons';
          })()
  );

  function getFolderLabel(comparison: Comparison): string {
    if (!comparison.folderId) return 'Unfiled';
    return folderNameById.get(comparison.folderId) ?? comparison.folderId;
  }

  const folderOptions = $derived([
    'Unfiled',
    ...[...foldersState.folders].sort((a, b) => a.name.localeCompare(b.name)).map((f) => f.name),
  ]);

  function getFolderIdByName(name: string): string | null {
    if (name === 'Unfiled') return null;
    return foldersState.folders.find((f) => f.name === name)?.id ?? null;
  }

  function getFolderNameById(id: string | null): string {
    if (!id) return 'Unfiled';
    return folderNameById.get(id) ?? id;
  }

  async function handleFolderUpdate(comparisonId: string, newFolderId: string | null) {
    editingError = null;

    const comparison = comparisons.find((c) => c.id === comparisonId);
    if (!comparison) {
      editingComparisonId = null;
      return;
    }

    const originalFolderId = comparison.folderId;

    if (originalFolderId === newFolderId) {
      editingComparisonId = null;
      return;
    }

    comparisons = comparisons.map((c) =>
      c.id === comparisonId ? { ...c, folderId: newFolderId } : c
    );

    if (activeFolderId !== 'all' && activeFolderId !== 'unfiled') {
      if (newFolderId !== activeFolderId) {
        comparisons = comparisons.filter((c) => c.id !== comparisonId);
      }
    }

    editingComparisonId = null;

    try {
      await updateComparisonFolder(comparisonId, newFolderId);
    } catch (e) {
      editingError = e instanceof Error ? e.message : 'Failed to update folder';

      if (
        activeFolderId !== 'all' &&
        activeFolderId !== 'unfiled' &&
        newFolderId !== activeFolderId
      ) {
        await loadComparisons();
      } else {
        comparisons = comparisons.map((c) =>
          c.id === comparisonId ? { ...c, folderId: originalFolderId } : c
        );
      }
    }
  }

  async function loadComparisons() {
    isLoading = true;
    error = null;
    try {
      const folderId = activeFolderId === 'all' ? undefined : activeFolderId;
      const list = await getComparisons({ folderId });
      comparisons = list;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load comparisons';
      comparisons = [];
    } finally {
      isLoading = false;
    }
  }

  // Re-fetch comparisons when active folder changes
  $effect(() => {
    const _folderId = activeFolderId;
    loadComparisons();
  });

  function handleDeleteClick(id: string) {
    comparisonToDelete = id;
  }

  function handleCancelDelete() {
    comparisonToDelete = null;
  }

  async function handleConfirmDelete() {
    if (!comparisonToDelete) return;

    isDeleting = true;
    try {
      await deleteComparison(comparisonToDelete);
      await loadComparisons();
      comparisonToDelete = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to delete comparison';
    } finally {
      isDeleting = false;
    }
  }

  function formatDate(date: number | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
</script>

<section class="mx-auto w-[85%] max-w-screen-2xl py-6">
  <div class="mb-6 flex items-center justify-between">
    <h1 class="text-2xl font-semibold text-text-primary">{pageTitle}</h1>
  </div>

  <!-- Folder Filter Tabs -->
  <div class="mb-4 flex flex-wrap items-center gap-2">
    <a
      href={comparisonsFolderHref('all')}
      class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {isFolderActive('all')
        ? 'bg-accent text-white'
        : 'bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary'}"
    >
      All
    </a>

    {#each pinnedFolders as folder (folder.id)}
      <a
        href={comparisonsFolderHref(folder.id)}
        class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 {isFolderActive(
          folder.id
        )
          ? 'bg-accent text-white'
          : 'bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary'}"
      >
        <span
          class="material-icons text-base shrink-0"
          style="color: {folder.color || '#64748b'}"
          aria-hidden="true">folder</span
        >
        {folder.name}
      </a>
    {/each}

    {#each unpinnedFolders as folder (folder.id)}
      <a
        href={comparisonsFolderHref(folder.id)}
        class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 {isFolderActive(
          folder.id
        )
          ? 'bg-accent text-white'
          : 'bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary'}"
      >
        <span
          class="material-icons text-base shrink-0"
          style="color: {folder.color || '#64748b'}"
          aria-hidden="true">folder</span
        >
        {folder.name}
      </a>
    {/each}

    <!-- Unfiled tab (always show so user can filter to unfiled when no folders exist) -->
    <a
      href={comparisonsFolderHref('unfiled')}
      class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors {isFolderActive('unfiled')
        ? 'bg-accent text-white'
        : 'bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary'}"
    >
      Unfiled
    </a>
  </div>

  {#if editingError}
    <div class="mb-4 rounded-md border border-danger/20 bg-danger/10 p-3 backdrop-blur">
      <p class="text-sm font-medium text-danger">{editingError}</p>
    </div>
  {/if}

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
        Create a comparison from Workouts to save it here.
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
              Folder
            </th>
            <th
              scope="col"
              class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary"
            >
              Activity Date
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
              onclick={(e) => {
                if ((e.target as HTMLElement).closest?.('[data-folder-cell]')) return;
                push(`/compare/${comparison.id}`);
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if ((e.target as HTMLElement).closest?.('[data-folder-cell]')) return;
                  e.preventDefault();
                  push(`/compare/${comparison.id}`);
                }
              }}
            >
              <td class="px-6 py-4">
                <div class="font-medium text-text-primary">{comparison.name}</div>
                <div class="mt-1 flex flex-wrap gap-1">
                  {#if comparison.mixed}
                    <span
                      class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-600"
                      title="Events in this comparison span more than one folder"
                    >
                      Mixed
                    </span>
                  {/if}
                  {#if comparison.surfaced}
                    <span
                      class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-surface text-text-secondary border border-border"
                      title="Shown here because it references an event in this folder"
                    >
                      Surfaced
                    </span>
                  {/if}
                </div>
              </td>
              <td class="px-6 py-4 text-text-secondary">
                {comparison.eventIds.length} event{comparison.eventIds.length > 1 ? 's' : ''}
              </td>
              <td class="px-6 py-4 text-sm" data-folder-cell>
                {#if editingComparisonId === comparison.id}
                  <div class="w-48">
                    <SearchableSelect
                      options={folderOptions}
                      value={getFolderNameById(comparison.folderId ?? null)}
                      placeholder="Select folder..."
                      oncommit={(name) =>
                        handleFolderUpdate(comparison.id, getFolderIdByName(name))}
                      oncancel={() => (editingComparisonId = null)}
                    />
                  </div>
                {:else}
                  <button
                    type="button"
                    class="text-text-secondary hover:text-text-primary hover:underline"
                    onclick={(e) => {
                      e.stopPropagation();
                      editingComparisonId = comparison.id;
                    }}
                  >
                    {getFolderLabel(comparison)}
                  </button>
                {/if}
              </td>
              <td class="px-6 py-4 text-text-secondary">
                {formatDate(comparison.referenceActivityStartDate)}
              </td>
              <td class="px-6 py-4 text-text-secondary">{formatDate(comparison.createdAt)}</td>
              <td class="whitespace-nowrap px-6 py-4 text-right font-medium">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 font-medium text-text-primary shadow-sm hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent"
                    onclick={(e) => {
                      e.stopPropagation();
                      push(`/compare/${comparison.id}`);
                    }}
                  >
                    <span class="material-icons text-[1.15em] leading-none" aria-hidden="true"
                      >search</span
                    >
                    View
                  </button>
                  <button
                    type="button"
                    class="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-danger/30 bg-card px-3 font-medium text-danger shadow-sm hover:bg-danger/10 focus:outline-none focus:ring-2 focus:ring-danger"
                    onclick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(comparison.id);
                    }}
                  >
                    <span class="material-icons text-[1.15em] leading-none" aria-hidden="true"
                      >delete</span
                    >
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

  {#if comparisonToDelete}
    <ConfirmDialog
      title="Delete Comparison?"
      message="Are you sure you want to delete this comparison? This action cannot be undone."
      confirmLabel="Delete"
      loading={isDeleting}
      danger={true}
      confirmDisabled={isDeleting}
      onConfirm={handleConfirmDelete}
      onCancel={handleCancelDelete}
    />
  {/if}
</section>
