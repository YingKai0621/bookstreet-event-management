import { useState } from 'react';
import { clampPage, getPageCount, getPageOffset, LIST_PAGE_SIZE } from '../constants/pagination';

/** Every CRUD collection uses the same page size, independent of screen height. */
export function useListPagination<T>(items: readonly T[], pageSize = LIST_PAGE_SIZE) {
  const size = Math.max(1, Math.min(LIST_PAGE_SIZE, Math.trunc(pageSize) || LIST_PAGE_SIZE));
  const pages = getPageCount(items.length, size);
  const [requestedPage, setPage] = useState(1);
  const page = clampPage(requestedPage, pages);
  if (page !== requestedPage) setPage(page);
  const offset = getPageOffset(page, size);
  return {
    items: items.slice(offset, offset + size), page, pages, total: items.length,
    setPage, reset: () => setPage(1),
  };
}
