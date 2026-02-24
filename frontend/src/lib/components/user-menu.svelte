<script lang="ts">
  import { logout } from '../stores/auth';
  const props = $props<{
    displayName: string | null;
    avatarUrl: string | null;
    collapsed?: boolean;
  }>();

  function initials(name: string | null) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    const letters = parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
    return letters || 'U';
  }
</script>

<div class="flex items-center gap-3 px-4 py-3">
  {#if props.avatarUrl}
    <img src={props.avatarUrl} alt="avatar" class="h-8 w-8 rounded-full object-cover" />
  {:else}
    <div
      class="flex h-8 w-8 items-center justify-center rounded-full bg-card text-sm font-semibold text-text-primary"
    >
      {initials(props.displayName)}
    </div>
  {/if}
  {#if !props.collapsed}
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm text-text-primary">{props.displayName ?? 'User'}</div>
      <button
        class="mt-1 text-xs text-accent hover:underline"
        onclick={() => logout()}
        type="button"
      >
        Logout
      </button>
    </div>
  {/if}
</div>
