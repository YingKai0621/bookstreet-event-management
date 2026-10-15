interface Props { page: number; pages: number; total: number; onPage: (page: number) => void; }
export function CompactPagination({ page, pages, total, onPage }: Props) {
  return <nav className="compact-pagination" aria-label="Phân trang">
    <span>{total} bản ghi · Trang {page + 1}/{pages}</span>
    <div><button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>Trước</button>
      <button type="button" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Sau</button></div>
  </nav>;
}
