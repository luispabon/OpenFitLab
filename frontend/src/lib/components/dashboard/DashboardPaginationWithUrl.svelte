<script lang="ts">
  import { push, querystring } from 'svelte-spa-router';
  import DashboardPaginator from './DashboardPaginator.svelte';

  const PAGE_SIZE_OPTIONS = [20, 30, 40, 50] as const;

  interface Props {
    totalRows: number;
    page?: number;
    pageSize?: number;
  }
  let { totalRows, page = $bindable(1), pageSize = $bindable(20) }: Props = $props();

  let suppressUrlSync = false;
  let lastQuerystringSynced = $state<string | undefined>(undefined);

  function parsePageFromQueryString(qs: string): { page: number; pageSize: number } {
    const params = new URLSearchParams(qs);
    const p = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);
    const ps = parseInt(params.get('pageSize') ?? '20', 10);
    const valid = PAGE_SIZE_OPTIONS.includes(ps as (typeof PAGE_SIZE_OPTIONS)[number]);
    return { page: p, pageSize: valid ? ps : 20 };
  }

  function buildDashboardPath(p: number, ps: number): string {
    const parts: string[] = [];
    parts.push(`page=${p}`);
    if (ps !== 20) parts.push(`pageSize=${ps}`);
    return `/?${parts.join('&')}`;
  }

  $effect(() => {
    const qs = $querystring ?? '';
    if (lastQuerystringSynced !== undefined && qs === lastQuerystringSynced) return;
    lastQuerystringSynced = qs;
    const parsed = parsePageFromQueryString(qs);
    suppressUrlSync = true;
    page = parsed.page;
    pageSize = parsed.pageSize;
    queueMicrotask(() => {
      suppressUrlSync = false;
    });
  });

  $effect(() => {
    const p = page;
    const ps = pageSize;
    if (suppressUrlSync) return;
    const target = buildDashboardPath(p, ps);
    const currentQs = $querystring ?? '';
    const current = parsePageFromQueryString(currentQs);
    if (current.page !== p || current.pageSize !== ps) {
      push(target);
    }
  });

  const totalPages = $derived(Math.max(1, Math.ceil(totalRows / pageSize)));

  $effect(() => {
    if (totalPages > 0 && page > totalPages) {
      page = totalPages;
    }
  });

  const pageRangeStart = $derived(totalRows === 0 ? 0 : (page - 1) * pageSize + 1);
  const pageRangeEnd = $derived(totalRows === 0 ? 0 : Math.min(page * pageSize, totalRows));
  const pageRangeText = $derived(
    totalRows === 0
      ? '0 of 0'
      : pageRangeStart === pageRangeEnd
        ? `${pageRangeStart} of ${totalRows}`
        : `${pageRangeStart}-${pageRangeEnd} of ${totalRows}`
  );

  const currentPageFromUrl = $derived.by(() => {
    const parsed = parsePageFromQueryString($querystring ?? '');
    const total = totalPages;
    return Math.min(Math.max(1, parsed.page), total);
  });

  const visiblePageNumbers = $derived.by(() => {
    const total = totalPages;
    if (total <= 1) return [];
    const current = Math.min(currentPageFromUrl, total);
    const delta = 2;
    const range: number[] = [];
    const add = (n: number) => {
      if (n >= 1 && n <= total && !range.includes(n)) range.push(n);
    };
    add(1);
    for (let i = current - delta; i <= current + delta; i++) add(i);
    add(total);
    range.sort((a, b) => a - b);
    return range;
  });

  function goToPage(p: number) {
    if (p < 1 || p > totalPages) return;
    const target = buildDashboardPath(p, pageSize);
    const newQs = target.slice(target.indexOf('?') + 1);
    lastQuerystringSynced = newQs;
    push(target);
    page = p;
  }

  function onPageSizeChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    const n = Number(val) as (typeof PAGE_SIZE_OPTIONS)[number];
    if (PAGE_SIZE_OPTIONS.includes(n)) {
      pageSize = n;
      page = 1;
    }
  }
</script>

<div class="mb-3">
  <DashboardPaginator
    {totalRows}
    {pageSize}
    {totalPages}
    {currentPageFromUrl}
    {visiblePageNumbers}
    {pageRangeText}
    {onPageSizeChange}
    {goToPage}
  />
</div>

<slot />

<div class="mt-3">
  <DashboardPaginator
    {totalRows}
    {pageSize}
    {totalPages}
    {currentPageFromUrl}
    {visiblePageNumbers}
    {pageRangeText}
    idSuffix="-bottom"
    {onPageSizeChange}
    {goToPage}
  />
</div>
