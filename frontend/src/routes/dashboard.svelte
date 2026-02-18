<script lang="ts">
  import { push } from 'svelte-spa-router'
</script>

<section class="p-6">
  <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
  <p class="mt-2 text-gray-600 dark:text-gray-400">Hello from the dashboard.</p>
  <a
    href="/event/example-id"
    class="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
    onclick={(e) => {
      e.preventDefault()
      push('/event/example-id')
    }}
  >
    View example event
  </a>
</section>
