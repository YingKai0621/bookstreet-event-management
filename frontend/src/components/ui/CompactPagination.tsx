import { ListPagination } from './ListPagination';

interface Props { page: number; pages: number; total: number; onPage: (page: number) => void; disabled?: boolean; }
export function CompactPagination({ page, pages, total, onPage, disabled }: Props) {
  return <div className="compact-pagination">
    <span>{total} bản ghi</span>
    <ListPagination page={page} pages={pages} onPage={onPage} disabled={disabled} />
  </div>;
}
