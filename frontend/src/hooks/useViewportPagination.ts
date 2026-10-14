import { useEffect, useState } from 'react';

export function useViewportPagination<T>(items: T[], reservedHeight = 380, rowHeight = 64, maxColumns = 1) {
  const [height, setHeight] = useState(() => window.innerHeight);
  const [width, setWidth] = useState(() => window.innerWidth);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const resize = () => { setHeight(window.innerHeight); setWidth(window.innerWidth); };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const columns = Math.max(1, Math.min(maxColumns, Math.floor((width - 280) / 320)));
  const size = Math.max(1, Math.min(10, Math.max(1, Math.floor((height - reservedHeight) / rowHeight)) * columns));
  const pages = Math.max(1, Math.ceil(items.length / size));
  const currentPage = Math.min(page, pages - 1);
  return { items: items.slice(currentPage * size, (currentPage + 1) * size), page: currentPage, pages,
    total: items.length, setPage, reset: () => setPage(0) };
}
