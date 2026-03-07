<script lang="ts">
  import type { Folder } from '../../types/event';

  interface Props {
    folder: Folder;
    pinnedCount: number;
    maxPinned: number;
    onRename: () => void;
    onRecolor: () => void;
    onPinToggle: (folder: Folder) => void;
    onDelete: () => void;
    onClose: () => void;
    anchor: HTMLElement | null;
  }
  let {
    folder,
    pinnedCount,
    maxPinned,
    onRename,
    onRecolor,
    onPinToggle,
    onDelete,
    onClose,
    anchor,
  }: Props = $props();

  const canPin = $derived(!folder.pinned && pinnedCount < maxPinned);

  const rect = $derived(anchor?.getBoundingClientRect());
</script>

{#if anchor && rect}
  <!-- Backdrop to close on outside click -->
  <div class="fixed inset-0 z-40" aria-hidden="true" onclick={onClose}></div>
  <div
    class="fixed z-50 min-w-[10rem] rounded-md border border-border bg-surface py-1 shadow-lg"
    style="left: {rect.left}px; top: {rect.bottom + 4}px;"
    role="menu"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-card-hover"
      role="menuitem"
      onclick={() => {
        onRename();
        onClose();
      }}
    >
      <span class="material-icons text-base">edit</span>
      Rename
    </button>
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-card-hover"
      role="menuitem"
      onclick={() => {
        onRecolor();
        onClose();
      }}
    >
      <span class="material-icons text-base">palette</span>
      Change color
    </button>
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-card-hover disabled:opacity-50"
      role="menuitem"
      disabled={folder.pinned ? false : !canPin}
      onclick={() => {
        onPinToggle(folder);
        onClose();
      }}
    >
      <span class="material-icons text-base">{folder.pinned ? 'push_pin' : 'push_pin'}</span>
      {folder.pinned ? 'Unpin' : 'Pin'}
    </button>
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-card-hover"
      role="menuitem"
      onclick={() => {
        onDelete();
        onClose();
      }}
    >
      <span class="material-icons text-base">delete</span>
      Delete
    </button>
  </div>
{/if}
