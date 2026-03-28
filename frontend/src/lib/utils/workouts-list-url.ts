const DEFAULT_PAGE_SIZE = 20;

/**
 * Hash path segment for the workouts list (passed to svelte-spa-router `push`).
 * Preserves `folder` when not `all` so pagination does not clear folder context.
 */
export function buildWorkoutsListPushPath(
  page: number,
  pageSize: number,
  folderId: 'all' | 'unfiled' | string,
  defaultPageSize: number = DEFAULT_PAGE_SIZE
): string {
  const parts: string[] = [];
  parts.push(`page=${Math.max(1, page)}`);
  if (pageSize !== defaultPageSize) {
    parts.push(`pageSize=${pageSize}`);
  }
  if (folderId !== 'all') {
    parts.push(`folder=${encodeURIComponent(folderId)}`);
  }
  return `/?${parts.join('&')}`;
}
