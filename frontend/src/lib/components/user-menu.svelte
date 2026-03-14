<script lang="ts">
  import { push, replace } from 'svelte-spa-router';
  import { logout } from '../stores/auth.svelte';
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
      <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0 text-xs">
        <button class="text-accent hover:underline" onclick={() => push('/account')} type="button">
          Account
        </button>
        <button
          class="text-accent hover:underline"
          onclick={async () => {
            await logout();
            replace('/');
          }}
          type="button">Logout</button
        >
      </div>
    </div>
  {/if}
</div>
