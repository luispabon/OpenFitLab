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

{#if props.collapsed}
  <div class="mx-2 mb-2 mt-1 flex justify-center rounded-lg border border-border bg-card p-2">
    {#if props.avatarUrl}
      <img
        src={props.avatarUrl}
        alt="avatar"
        class="h-9 w-9 rounded-full object-cover ring-2 ring-accent/30 ring-offset-1 ring-offset-card"
      />
    {:else}
      <div
        class="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent"
      >
        {initials(props.displayName)}
      </div>
    {/if}
  </div>
{:else}
  <div
    class="mx-2 mb-2 mt-1 flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
  >
    {#if props.avatarUrl}
      <img
        src={props.avatarUrl}
        alt="avatar"
        class="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-accent/30 ring-offset-1 ring-offset-card"
      />
    {:else}
      <div
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-semibold text-accent"
      >
        {initials(props.displayName)}
      </div>
    {/if}
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm font-medium text-text-primary">
        {props.displayName ?? 'User'}
      </div>
      <div class="mt-1.5 flex items-center gap-2">
        <button
          class="rounded-md bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
          onclick={() => push('/account')}
          type="button"
        >
          Account
        </button>
        <button
          class="rounded-md bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
          onclick={async () => {
            await logout();
            replace('/');
          }}
          type="button"
        >
          Logout
        </button>
      </div>
    </div>
  </div>
{/if}
