<script lang="ts">
  interface Props {
    params?: { id?: string }
  }
  let { params = {} }: Props = $props()

  import { push } from 'svelte-spa-router'
  const id = $derived(params?.id ?? '')
</script>

<section class="p-6">
  <button
    type="button"
    class="mb-4 rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
    onclick={() => push('/')}
  >
    ← Back to Dashboard
  </button>
  <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Event detail</h1>
  <p class="mt-2 text-gray-600 dark:text-gray-400">Event ID: {id || '(none)'}</p>
</section>
