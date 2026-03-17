<script lang="ts">
  interface Props {
    options: string[];
    value: string;
    allowCustom?: boolean;
    placeholder?: string;
    oncommit: (value: string) => void;
    oncancel: () => void;
  }
  let {
    options,
    value,
    allowCustom = false,
    placeholder = 'Search…',
    oncommit,
    oncancel,
  }: Props = $props();

  let rootEl = $state<HTMLDivElement | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);
  let listboxEl = $state<HTMLDivElement | null>(null);
  let query = $state('');
  let highlightedIndex = $state(0);
  let dropdownStyle = $state('');

  // Portal action: moves the listbox to document.body so that position:fixed
  // is relative to the viewport, not a backdrop-filter/transform ancestor.
  function portalAction(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function updateDropdownPosition() {
    if (!rootEl || !listboxEl) return;
    const rect = rootEl.getBoundingClientRect();
    const maxHeight = 240; // max-h-60 = 15rem = 240px
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    let maxH: number;

    // Position below if there's enough space, otherwise above
    if (spaceBelow >= maxHeight || spaceBelow >= spaceAbove) {
      top = rect.bottom;
      maxH = Math.min(maxHeight, spaceBelow - 8);
    } else {
      maxH = Math.min(maxHeight, spaceAbove - 8);
      top = rect.top - maxH - 4;
    }

    dropdownStyle = `position: fixed; top: ${top}px; left: ${rect.left}px; width: ${rect.width}px; max-height: ${maxH}px;`;
  }

  $effect(() => {
    query = value;
  });

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.toLowerCase().includes(q));
  });

  const showCustomHint = $derived(
    allowCustom && query.trim().length > 0 && !filtered.includes(query.trim())
  );
  const canCommitCustom = $derived(allowCustom && query.trim().length > 0);
  const displayList = $derived(showCustomHint ? [query.trim(), ...filtered] : filtered);

  function commit(val: string) {
    const v = val.trim();
    if (v) oncommit(v);
  }

  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        oncancel();
        return;
      case 'Enter':
        e.preventDefault();
        if (
          displayList.length > 0 &&
          highlightedIndex >= 0 &&
          highlightedIndex < displayList.length
        ) {
          commit(displayList[highlightedIndex]);
        } else if (canCommitCustom) {
          commit(query.trim());
        }
        return;
      case 'ArrowDown':
        e.preventDefault();
        highlightedIndex = Math.min(highlightedIndex + 1, displayList.length - 1);
        return;
      case 'ArrowUp':
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, 0);
        return;
      default:
        break;
    }
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as Node;
    // Check both root (contains input) and listbox since listbox uses fixed position outside root
    const isInsideRoot = rootEl?.contains(target);
    const isInsideListbox = listboxEl?.contains(target);
    if (!isInsideRoot && !isInsideListbox) {
      oncancel();
    }
  }

  $effect(() => {
    void query;
    const handler = handleClickOutside;
    window.addEventListener('click', handler, true);
    return () => window.removeEventListener('click', handler, true);
  });

  $effect(() => {
    if (inputEl) {
      inputEl.focus();
      inputEl.select();
    }
  });

  $effect(() => {
    void query;
    void displayList.length;
    highlightedIndex = 0;
  });

  // Update dropdown position when it renders
  $effect(() => {
    if (listboxEl) {
      updateDropdownPosition();
    }
  });

  // Listen for scroll/resize to update position
  $effect(() => {
    const handler = () => {
      if (listboxEl) updateDropdownPosition();
    };
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  });
</script>

<div bind:this={rootEl} class="searchable-select-root relative w-full min-w-[12rem]">
  <input
    bind:this={inputEl}
    type="text"
    bind:value={query}
    onkeydown={handleKeydown}
    {placeholder}
    class="w-full rounded-lg border border-border bg-surface px-3 py-2 text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
    role="combobox"
    aria-expanded="true"
    aria-controls="searchable-select-listbox"
    aria-autocomplete="list"
  />
</div>

<!-- Fixed-positioned dropdown, portalled to body to escape backdrop-filter/transform ancestors -->
<div
  use:portalAction
  bind:this={listboxEl}
  id="searchable-select-listbox"
  role="listbox"
  class="z-[9999] overflow-auto rounded-lg border border-border bg-surface-solid shadow-lg"
  style={dropdownStyle}
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
          <span class="text-text-secondary">Use "{opt}"</span>
        {:else}
          {opt}
        {/if}
      </button>
    {/each}
  {/if}
</div>
