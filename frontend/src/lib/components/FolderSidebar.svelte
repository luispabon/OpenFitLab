<script lang="ts">
  import { state as authState } from '../stores/auth.svelte';
  import { loadFolders, buildFolderHash } from '../stores/folders.svelte';
  import type { Folder, FolderSelectionValue } from '../types/event';
  import { FOLDER_SELECTION_ALL, FOLDER_SELECTION_UNFILED } from '../types/event';
  import { updateFolder } from '../api/folders';
  import { updateEventFolder } from '../api/events';
  import { workoutDragState, endWorkoutDrag } from '../stores/workout-drag.svelte';
  import LoadingSpinner from './LoadingSpinner.svelte';
  import UserMenu from './user-menu.svelte';

  import FolderCreateModal from './folders/FolderCreateModal.svelte';
  import FolderRenameModal from './folders/FolderRenameModal.svelte';
  import FolderColorModal from './folders/FolderColorModal.svelte';
  import FolderDeleteModal from './folders/FolderDeleteModal.svelte';
  import FolderContextMenu from './folders/FolderContextMenu.svelte';

  import logoIcon from '../../assets/logo-icon.svg';
  import logoBig from '../../assets/logo-big.svg';

  interface Props {
    sidebarCollapsed: boolean;
    sidebarEffectivelyExpanded: boolean;
    isWorkoutsActive: boolean;
    isComparisonsActive: boolean;
    activeFolderValue: FolderSelectionValue;
    folders: Folder[];
    onToggleSidebar: () => void;
    // The parent may still pass the old sidebar markup as children during the refactor.
    // FolderSidebar does not render slots, but we accept children for type safety.
    children?: unknown;
  }

  let {
    sidebarCollapsed,
    sidebarEffectivelyExpanded,
    isWorkoutsActive,
    isComparisonsActive,
    activeFolderValue,
    folders,
    onToggleSidebar,
  }: Props = $props();

  const MAX_FOLDERS = 20;
  const MAX_PINNED = 5;

  const folderList = $derived(folders);
  const pinnedFolders = $derived(
    [...folderList].filter((f) => f.pinned).sort((a, b) => a.name.localeCompare(b.name))
  );
  const unpinnedFolders = $derived(
    [...folderList].filter((f) => !f.pinned).sort((a, b) => a.name.localeCompare(b.name))
  );

  const pinnedCount = $derived(folderList.filter((f) => f.pinned).length);

  function isFolderActive(
    value: typeof FOLDER_SELECTION_ALL | typeof FOLDER_SELECTION_UNFILED | string
  ): boolean {
    return activeFolderValue === value;
  }

  let showCreateFolderModal = $state(false);
  let newFolderBtnEl = $state<HTMLElement | null>(null);
  let folderToRename = $state<Folder | null>(null);
  let folderToRecolor = $state<Folder | null>(null);
  let folderToDelete = $state<Folder | null>(null);
  let folderMenuFolder = $state<Folder | null>(null);
  let menuAnchorEl = $state<HTMLElement | null>(null);
  let folderActionAnchorEl = $state<HTMLElement | null>(null);
  let folderToastMessage = $state<string | null>(null);

  function showFolderToast(message: string) {
    folderToastMessage = message;
    setTimeout(() => {
      folderToastMessage = null;
    }, 4000);
  }

  async function handleFolderPinToggle(folder: Folder) {
    try {
      await updateFolder(folder.id, { pinned: !folder.pinned });
      loadFolders();
    } catch (error) {
      showFolderToast(error instanceof Error ? error.message : 'Failed to update folder');
    }
  }

  let dragOverFolderId = $state<string | null>(null);

  $effect(() => {
    const onDragEnd = () => endWorkoutDrag();
    window.addEventListener('dragend', onDragEnd);
    return () => window.removeEventListener('dragend', onDragEnd);
  });

  async function handleWorkoutFolderDrop(
    e: DragEvent,
    targetFolderId: string | null
  ): Promise<void> {
    e.preventDefault();
    dragOverFolderId = null;
    endWorkoutDrag();
    const data = e.dataTransfer?.getData('application/x-openfitlab-workout-ids');
    if (!data) return;
    const eventIds: string[] = JSON.parse(data);
    let successCount = 0;
    let failCount = 0;
    for (const id of eventIds) {
      try {
        await updateEventFolder(id, targetFolderId);
        successCount++;
      } catch {
        failCount++;
      }
    }

    const label = targetFolderId
      ? (folders.find((f) => f.id === targetFolderId)?.name ?? 'folder')
      : 'Unfiled';
    showFolderToast(
      failCount > 0
        ? `Moved ${successCount}, failed ${failCount}`
        : `Moved ${successCount} workout${successCount !== 1 ? 's' : ''} to ${label}`
    );
    loadFolders();
    window.dispatchEvent(new CustomEvent('workout-moved'));
  }
</script>

<nav
  class="fixed left-0 top-0 z-50 h-screen border-r border-border bg-surface backdrop-blur-xl transition-all duration-300"
  style="width: {sidebarEffectivelyExpanded ? '16rem' : '4rem'};"
>
  <div class="flex h-full flex-col">
    <!-- Logo/Branding -->
    <div class="flex items-center border-b border-border px-4 py-4">
      {#if !sidebarEffectivelyExpanded}
        <img src={logoIcon} alt="OpenFitLab" class="h-16" />
      {:else}
        <img src={logoBig} alt="OpenFitLab" class="h-16" />
      {/if}
    </div>

    {#if authState.authLoading}
      <div class="flex-1 grid place-items-center p-4">
        <LoadingSpinner />
      </div>
    {:else if !authState.user}
      <!-- When not authenticated, show only brand; user can use main area to login -->
      <div class="flex-1"></div>
    {:else}
      <!-- Navigation Items -->
      <div class="flex-1 py-4 overflow-y-auto">
        <div class="flex items-center">
          <a
            href="#/"
            class="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary {isWorkoutsActive
              ? 'bg-card-hover text-text-primary border-r-2 border-accent'
              : ''}"
          >
            <span class="material-icons">dashboard</span>
            {#if sidebarEffectivelyExpanded}
              <span>Workouts</span>
            {/if}
          </a>
          {#if sidebarEffectivelyExpanded}
            <button
              bind:this={newFolderBtnEl}
              type="button"
              class="rounded p-1.5 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary"
              aria-label="New folder"
              onclick={() => (showCreateFolderModal = true)}
            >
              <span class="material-icons text-base">create_new_folder</span>
            </button>
          {/if}
        </div>

        {#if sidebarEffectivelyExpanded}
          <div class="mt-1 pl-11">
            <div class="flex items-center gap-0.5 py-0.5">
              <a
                href={buildFolderHash(FOLDER_SELECTION_ALL)}
                class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-0 text-sm text-text-secondary transition-colors hover:text-text-primary {isWorkoutsActive &&
                isFolderActive(FOLDER_SELECTION_ALL)
                  ? 'bg-card-hover text-text-primary border-r-2 border-accent'
                  : ''}"
              >
                <span class="relative flex h-6 w-3 shrink-0 items-stretch" aria-hidden="true">
                  <span class="absolute left-0 top-0 bottom-1/2 w-px bg-white"></span>
                  <span class="absolute left-0 right-0 top-1/2 h-px bg-white"></span>
                </span>
                <span class="material-icons text-base shrink-0">folder_open</span>
                <span>All</span>
              </a>
            </div>
            <div
              class="flex items-center gap-0.5 py-0.5 rounded {dragOverFolderId === '__unfiled__'
                ? 'bg-card-hover ring-1 ring-accent'
                : ''}"
              ondragover={(e) => {
                if (!workoutDragState.isDragging) return;
                e.preventDefault();
                dragOverFolderId = '__unfiled__';
              }}
              ondragleave={() => {
                dragOverFolderId = null;
              }}
              ondrop={(e) => handleWorkoutFolderDrop(e, null)}
            >
              <a
                href={buildFolderHash(FOLDER_SELECTION_UNFILED)}
                class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-0 text-sm text-text-secondary transition-colors hover:text-text-primary {isWorkoutsActive &&
                isFolderActive(FOLDER_SELECTION_UNFILED)
                  ? 'bg-card-hover text-text-primary border-r-2 border-accent'
                  : ''}"
              >
                <span class="relative flex h-6 w-3 shrink-0 items-stretch" aria-hidden="true">
                  <span class="absolute left-0 top-0 bottom-1/2 w-px bg-white"></span>
                  <span class="absolute left-0 right-0 top-1/2 h-px bg-white"></span>
                </span>
                <span class="material-icons text-base shrink-0">folder_off</span>
                <span>Unfiled</span>
              </a>
            </div>
            {#each pinnedFolders as folder (folder.id)}
              <div
                class="flex items-center gap-0.5 py-0.5 rounded {dragOverFolderId === folder.id
                  ? 'bg-card-hover ring-1 ring-accent'
                  : ''}"
                ondragover={(e) => {
                  if (!workoutDragState.isDragging) return;
                  e.preventDefault();
                  dragOverFolderId = folder.id;
                }}
                ondragleave={() => {
                  dragOverFolderId = null;
                }}
                ondrop={(e) => handleWorkoutFolderDrop(e, folder.id)}
              >
                <a
                  href={buildFolderHash(folder.id)}
                  class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-0 text-sm text-text-secondary transition-colors hover:text-text-primary {isWorkoutsActive &&
                  isFolderActive(folder.id)
                    ? 'bg-card-hover text-text-primary border-r-2 border-accent'
                    : ''}"
                >
                  <span class="relative flex h-6 w-3 shrink-0 items-stretch" aria-hidden="true">
                    <span class="absolute left-0 top-0 bottom-1/2 w-px bg-white"></span>
                    <span class="absolute left-0 right-0 top-1/2 h-px bg-white"></span>
                  </span>
                  <span
                    class="material-icons text-base shrink-0"
                    style="color: {folder.color};"
                    aria-hidden="true">folder</span
                  >
                  <span class="truncate">{folder.name}</span>
                  <span class="material-icons text-base text-amber-500" title="Pinned"
                    >push_pin</span
                  >
                </a>
                <button
                  type="button"
                  class="rounded p-1 text-text-secondary hover:bg-card-hover hover:text-text-primary"
                  aria-label="Folder options for {folder.name}"
                  onclick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    folderMenuFolder = folder;
                    menuAnchorEl = e.currentTarget as HTMLElement;
                  }}
                >
                  <span class="material-icons text-base">more_vert</span>
                </button>
              </div>
            {/each}
            {#each unpinnedFolders as folder (folder.id)}
              <div
                class="flex items-center gap-0.5 py-0.5 rounded {dragOverFolderId === folder.id
                  ? 'bg-card-hover ring-1 ring-accent'
                  : ''}"
                ondragover={(e) => {
                  if (!workoutDragState.isDragging) return;
                  e.preventDefault();
                  dragOverFolderId = folder.id;
                }}
                ondragleave={() => {
                  dragOverFolderId = null;
                }}
                ondrop={(e) => handleWorkoutFolderDrop(e, folder.id)}
              >
                <a
                  href={buildFolderHash(folder.id)}
                  class="flex min-w-0 flex-1 items-center gap-2 py-2 pr-0 text-sm text-text-secondary transition-colors hover:text-text-primary {isWorkoutsActive &&
                  isFolderActive(folder.id)
                    ? 'bg-card-hover text-text-primary border-r-2 border-accent'
                    : ''}"
                >
                  <span class="relative flex h-6 w-3 shrink-0 items-stretch" aria-hidden="true">
                    <span class="absolute left-0 top-0 bottom-1/2 w-px bg-white"></span>
                    <span class="absolute left-0 right-0 top-1/2 h-px bg-white"></span>
                  </span>
                  <span
                    class="material-icons text-base shrink-0"
                    style="color: {folder.color};"
                    aria-hidden="true">folder</span
                  >
                  <span class="truncate">{folder.name}</span>
                </a>
                <button
                  type="button"
                  class="rounded p-1 text-text-secondary hover:bg-card-hover hover:text-text-primary"
                  aria-label="Folder options for {folder.name}"
                  onclick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    folderMenuFolder = folder;
                    menuAnchorEl = e.currentTarget as HTMLElement;
                  }}
                >
                  <span class="material-icons text-base">more_vert</span>
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <a
          href="#/comparisons"
          class="flex items-center gap-3 px-4 py-3 mt-2 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary {isComparisonsActive
            ? 'bg-card-hover text-text-primary border-r-2 border-accent'
            : ''}"
        >
          <span class="material-icons">compare_arrows</span>
          {#if sidebarEffectivelyExpanded}
            <span>Comparisons</span>
          {/if}
        </a>
      </div>

      <!-- Folder modals and context menu -->
      {#if folderMenuFolder && menuAnchorEl}
        <FolderContextMenu
          folder={folderMenuFolder}
          {pinnedCount}
          maxPinned={MAX_PINNED}
          anchor={menuAnchorEl}
          onRename={() => {
            folderToRename = folderMenuFolder;
            folderActionAnchorEl = menuAnchorEl;
            folderMenuFolder = null;
            menuAnchorEl = null;
          }}
          onRecolor={() => {
            folderToRecolor = folderMenuFolder;
            folderActionAnchorEl = menuAnchorEl;
            folderMenuFolder = null;
            menuAnchorEl = null;
          }}
          onPinToggle={handleFolderPinToggle}
          onDelete={() => {
            folderToDelete = folderMenuFolder;
            folderActionAnchorEl = menuAnchorEl;
            folderMenuFolder = null;
            menuAnchorEl = null;
          }}
          onClose={() => {
            folderMenuFolder = null;
            menuAnchorEl = null;
          }}
        />
      {/if}
      <FolderCreateModal
        open={showCreateFolderModal}
        anchorEl={newFolderBtnEl}
        existingNames={folderList.map((f) => f.name)}
        maxFolders={MAX_FOLDERS}
        onCreated={() => {
          loadFolders();
        }}
        onClosed={() => (showCreateFolderModal = false)}
        onError={showFolderToast}
      />
      <FolderRenameModal
        folder={folderToRename}
        existingNames={folderList.map((f) => f.name)}
        anchorEl={folderActionAnchorEl}
        onDone={loadFolders}
        onClosed={() => {
          folderToRename = null;
          folderActionAnchorEl = null;
        }}
        onError={showFolderToast}
      />
      <FolderColorModal
        folder={folderToRecolor}
        anchorEl={folderActionAnchorEl}
        onDone={loadFolders}
        onClosed={() => {
          folderToRecolor = null;
          folderActionAnchorEl = null;
        }}
        onError={showFolderToast}
      />
      <FolderDeleteModal
        folder={folderToDelete}
        anchorEl={folderActionAnchorEl}
        onDone={() => {
          const deletedId = folderToDelete?.id;
          loadFolders();
          if (deletedId && activeFolderValue === deletedId) {
            window.location.hash = '#/';
          }
        }}
        onClosed={() => {
          folderToDelete = null;
          folderActionAnchorEl = null;
        }}
        onError={showFolderToast}
      />
      {#if folderToastMessage}
        <div
          class="fixed bottom-20 left-4 z-50 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary shadow-lg"
          role="alert"
        >
          {folderToastMessage}
        </div>
      {/if}

      <!-- User Menu -->
      <div class="border-t border-border">
        <UserMenu
          displayName={authState.user?.displayName ?? null}
          avatarUrl={authState.user?.avatarUrl ?? null}
          collapsed={sidebarCollapsed}
        />
      </div>
    {/if}

    <!-- Collapse Toggle -->
    <div class="border-t border-border p-4">
      <button
        type="button"
        class="flex w-full items-center gap-3 rounded px-4 py-2 text-text-secondary transition-colors hover:bg-card-hover hover:text-text-primary"
        onclick={onToggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <span class="material-icons"
          >{sidebarEffectivelyExpanded ? 'chevron_left' : 'chevron_right'}</span
        >
        {#if sidebarEffectivelyExpanded}
          <span>Collapse</span>
        {/if}
      </button>
    </div>
  </div>
</nav>
