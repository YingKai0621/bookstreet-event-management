import type { MouseEvent } from 'react';
import { clampPage, getPaginationItems } from '../../constants/pagination';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from './Pagination';

interface Props {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  disabled?: boolean;
  getHref?: (page: number) => string;
}

/** All props and callbacks use visible, 1-based page numbers. */
export function ListPagination({ page, pages, onPage, disabled = false, getHref }: Props) {
  const count = Math.max(1, pages);
  const current = clampPage(page, count);
  const href = (target: number) => {
    if (getHref) return getHref(target);
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(target));
    return `${url.pathname}${url.search}${url.hash}`;
  };
  const linkProps = (target: number, unavailable = false) => ({
    href: unavailable || disabled ? undefined : href(target),
    'aria-disabled': unavailable || disabled || undefined,
    tabIndex: unavailable || disabled ? -1 : undefined,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      if (unavailable || disabled) { event.preventDefault(); return; }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      if (target !== current) onPage(clampPage(target, count));
    },
  });
  return <Pagination><PaginationContent>
    <PaginationItem><PaginationPrevious {...linkProps(current - 1, current === 1)} /></PaginationItem>
    {getPaginationItems(current, count).map((item, index) => <PaginationItem key={`${item}-${index}`}>
      {item === 'ellipsis' ? <PaginationEllipsis /> : <PaginationLink {...linkProps(item)}
        isActive={item === current} aria-label={`Trang ${item}`}>{item}</PaginationLink>}
    </PaginationItem>)}
    <PaginationItem><PaginationNext {...linkProps(current + 1, current === count)} /></PaginationItem>
  </PaginationContent></Pagination>;
}
