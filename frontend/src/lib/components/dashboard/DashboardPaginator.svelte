<script lang="ts">
  const PAGE_SIZE_OPTIONS = [20, 30, 40, 50] as const

  interface Props {
    totalRows: number
    pageSize: number
    totalPages: number
    currentPageFromUrl: number
    visiblePageNumbers: number[]
    pageRangeText: string
    idSuffix?: string
    onPageSizeChange: (e: Event) => void
    goToPage: (p: number) => void
  }
  let {
    totalRows,
    pageSize,
    totalPages,
    currentPageFromUrl,
    visiblePageNumbers,
    pageRangeText,
    idSuffix = '',
    onPageSizeChange,
    goToPage,
  }: Props = $props()

  const sizeSelectId = `page-size-select${idSuffix}`
  const jumpSelectId = `jump-to-page${idSuffix}`
</script>

{#if totalRows > 0}
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <label for={sizeSelectId} class="text-sm text-text-secondary">Per page</label>
      <select
        id={sizeSelectId}
        value={pageSize}
        onchange={onPageSizeChange}
        class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {#each PAGE_SIZE_OPTIONS as size}
          <option value={size}>{size}</option>
        {/each}
      </select>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        disabled={currentPageFromUrl <= 1}
        onclick={() => goToPage(currentPageFromUrl - 1)}
        class="inline-flex h-9 w-9 items-center justify-center rounded-[28%] border border-border bg-surface text-text-primary hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:pointer-events-none"
        aria-label="Previous page"
      >
        <span class="material-icons text-lg">chevron_left</span>
      </button>
      {#each visiblePageNumbers as p, i}
        {#if i > 0 && p - (visiblePageNumbers[i - 1] ?? 0) > 1}
          <span class="px-1 text-text-secondary">…</span>
        {/if}
        <button
          type="button"
          onclick={() => goToPage(p)}
          class="inline-flex h-9 w-9 items-center justify-center rounded-[28%] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent {p === currentPageFromUrl
            ? 'border-0 bg-accent text-white'
            : 'border border-border bg-surface text-text-primary hover:bg-card-hover'}"
          aria-label="Page {p}"
          aria-current={p === currentPageFromUrl ? 'page' : undefined}
        >
          {p}
        </button>
      {/each}
      <button
        type="button"
        disabled={currentPageFromUrl >= totalPages}
        onclick={() => goToPage(currentPageFromUrl + 1)}
        class="inline-flex h-9 w-9 items-center justify-center rounded-[28%] border border-border bg-surface text-text-primary hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:pointer-events-none"
        aria-label="Next page"
      >
        <span class="material-icons text-lg">chevron_right</span>
      </button>
      <span class="text-sm text-text-secondary">{pageRangeText}</span>
      <label for={jumpSelectId} class="sr-only">Jump to page</label>
      <select
        id={jumpSelectId}
        value={currentPageFromUrl}
        onchange={(e) => goToPage(Number((e.target as HTMLSelectElement).value))}
        class="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        aria-label="Page {currentPageFromUrl} of {totalPages}"
      >
        {#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
          <option value={p}>Page {p} of {totalPages}</option>
        {/each}
      </select>
    </div>
  </div>
{/if}
