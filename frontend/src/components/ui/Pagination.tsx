import type { ComponentProps } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

// shadcn-style composition, using the project's existing CSS and icon system.
export function Pagination(props: ComponentProps<'nav'>) {
  return <nav aria-label="pagination" {...props} className="list-pagination" />;
}
export function PaginationContent(props: ComponentProps<'ul'>) {
  return <ul {...props} className="list-pagination-content" />;
}
export function PaginationItem(props: ComponentProps<'li'>) { return <li {...props} />; }
export function PaginationLink({ isActive, ...props }: ComponentProps<'a'> & { isActive?: boolean }) {
  return <a {...props} role="link" aria-current={isActive ? 'page' : undefined}
    className="list-pagination-link" />;
}
export function PaginationPrevious(props: ComponentProps<'a'>) {
  return <PaginationLink aria-label="Trang trước" {...props}><ChevronLeft size={16} aria-hidden="true" /></PaginationLink>;
}
export function PaginationNext(props: ComponentProps<'a'>) {
  return <PaginationLink aria-label="Trang sau" {...props}><ChevronRight size={16} aria-hidden="true" /></PaginationLink>;
}
export function PaginationEllipsis() {
  return <span className="list-pagination-ellipsis"><span aria-hidden="true">…</span><span className="pagination-sr-only">Các trang được thu gọn</span></span>;
}
