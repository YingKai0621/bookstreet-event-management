/** Maximum number of records shown in a paginated list. Fetch batches may be larger. */
export const LIST_PAGE_SIZE = 10;

export function getPageCount(total: number, size = LIST_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, size)));
}

export function clampPage(page: number, pages: number): number {
  return Math.max(1, Math.min(Number.isFinite(page) ? Math.trunc(page) : 1, Math.max(1, pages)));
}

/** The only conversion from a visible, 1-based page to an API/array index. */
export function toPageIndex(page: number): number {
  return clampPage(page, Number.MAX_SAFE_INTEGER) - 1;
}

export function getPageOffset(page: number, size = LIST_PAGE_SIZE): number {
  return toPageIndex(page) * size;
}

export function getPaginationItems(page: number, pages: number): Array<number | 'ellipsis'> {
  const current = clampPage(page, pages);
  if (pages <= 5) return Array.from({ length: Math.max(1, pages) }, (_, index) => index + 1);
  const visible = [...new Set([1, pages, current - 1, current, current + 1])]
    .filter(value => value >= 1 && value <= pages).sort((a, b) => a - b);
  const result: Array<number | 'ellipsis'> = [];
  visible.forEach((value, index) => {
    const previous = visible[index - 1];
    if (index > 0 && value - previous === 2) result.push(previous + 1);
    else if (index > 0 && value - previous > 2) result.push('ellipsis');
    result.push(value);
  });
  return result;
}
