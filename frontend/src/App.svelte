<script lang="ts">
  import Router from 'svelte-spa-router'
  import Dashboard from './routes/dashboard.svelte'
  import EventDetail from './routes/event-detail.svelte'

  const routes = {
    '/': Dashboard,
    '/event/:id': EventDetail,
    '*': Dashboard,
  }
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
  <header class="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <div class="mx-auto max-w-4xl px-4 py-3">
      <h1 class="text-lg font-medium text-gray-900 dark:text-white">OpenFitLab</h1>
    </div>
  </header>
  <main>
    <Router {routes} />
  </main>
</div>
