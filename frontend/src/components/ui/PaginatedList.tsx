import type { ReactNode } from 'react';
import { useListPagination } from '../../hooks/useListPagination';
import { CompactPagination } from './CompactPagination';

interface Props<T> {
  items: T[];
  children: (items: T[]) => ReactNode;
  pageSize?: number;
}

/** Paginate CRUD collections after filtering and sorting; page numbers are 1-based. */
export function PaginatedList<T>({ items, children, pageSize }: Props<T>) {
  const pagination = useListPagination(items, pageSize);
  return <>
    {children(pagination.items)}
    {items.length > 0 && <CompactPagination page={pagination.page} pages={pagination.pages}
      total={pagination.total} onPage={pagination.setPage} />}
  </>;
}
