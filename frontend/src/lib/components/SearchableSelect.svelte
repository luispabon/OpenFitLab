<script lang="ts">
  interface Props {
    options: string[]
    value: string
    allowCustom?: boolean
    placeholder?: string
    oncommit: (value: string) => void
    oncancel: () => void
  }
  let {
    options,
    value,
    allowCustom = false,
    placeholder = 'Search…',
    oncommit,
    oncancel,
  }: Props = $props()

  let inputEl = $state<HTMLInputElement | null>(null)
  let query = $state('')
  let highlightedIndex = $state(0)

  $effect(() => {
    query = value
  })

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((opt) => opt.toLowerCase().includes(q))
  })

  const showCustomHint = $derived(
    allowCustom && query.trim().length > 0 && !filtered.includes(query.trim())
  )
  const canCommitCustom = $derived(allowCustom && query.trim().length > 0)
  const displayList = $derived(showCustomHint ? [query.trim(), ...filtered] : filtered)

  function commit(val: string) {
    const v = val.trim()
    if (v) oncommit(v)
  }

  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        oncancel()
        return
      case 'Enter':
        e.preventDefault()
        if (displayList.length > 0 && highlightedIndex >= 0 && highlightedIndex < displayList.length) {
          commit(displayList[highlightedIndex])
        } else if (canCommitCustom) {
          commit(query.trim())
        }
        return
      case 'ArrowDown':
        e.preventDefault()
        highlightedIndex = Math.min(highlightedIndex + 1, displayList.length - 1)
        return
      case 'ArrowUp':
        e.preventDefault()
        highlightedIndex = Math.max(highlightedIndex - 1, 0)
        return
      default:
        break
    }
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as Node
    if (inputEl && !inputEl.closest('.searchable-select-root')?.contains(target)) {
      oncancel()
    }
  }

  $effect(() => {
    query
    const handler = handleClickOutside
    window.addEventListener('click', handler, true)
    return () => window.removeEventListener('click', handler, true)
  })

  $effect(() => {
    if (inputEl) {
      inputEl.focus()
      inputEl.select()
    }
  })

  $effect(() => {
    query
    displayList.length
    highlightedIndex = 0
  })
</script>

<div class="searchable-select-root relative w-full min-w-[12rem]">
  <input
    bind:this={inputEl}
    type="text"
    bind:value={query}
    onkeydown={handleKeydown}
    placeholder={placeholder}
    class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    role="combobox"
    aria-expanded="true"
    aria-controls="searchable-select-listbox"
    aria-autocomplete="list"
  />
  <div
    id="searchable-select-listbox"
    role="listbox"
    class="absolute top-full left-0 z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-surface-solid shadow-lg"
  >
    {#if displayList.length === 0 && !canCommitCustom}
      <div class="px-3 py-2 text-sm text-text-muted">No matches</div>
    {:else}
      {#each displayList as opt, i (opt + String(i))}
        <button
          type="button"
          role="option"
          aria-selected={i === highlightedIndex}
          class="w-full px-3 py-2 text-left text-sm transition-colors {i === highlightedIndex
            ? 'bg-card-hover-solid text-text-primary'
            : 'text-text-primary hover:bg-card-solid'}"
          onmouseenter={() => (highlightedIndex = i)}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => commit(opt)}
        >
          {#if showCustomHint && i === 0}
            <span class="text-text-secondary">Use “{opt}”</span>
          {:else}
            {opt}
          {/if}
        </button>
      {/each}
    {/if}
  </div>
</div>
