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

<div class="min-h-screen">
  <header class="sticky top-0 z-40 border-b border-border bg-surface backdrop-blur-xl">
    <div class="mx-auto w-[85%] max-w-screen-2xl py-3">
      <h1 class="text-lg font-medium text-text-primary">OpenFitLab</h1>
    </div>
  </header>
  <main>
    <Router {routes} />
  </main>
</div>
