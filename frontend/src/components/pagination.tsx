import type { PageMeta } from '@/lib/types';

export function Pagination({ meta, onPage }: { meta: PageMeta; onPage: (page: number) => void }) {
  if (meta.lastPage <= 1) return null;
  const pages = Array.from({ length: meta.lastPage }, (_, index) => index + 1).filter((page) => page === 1 || page === meta.lastPage || Math.abs(page - meta.currentPage) <= 1);
  return <div className="mt-4 flex justify-end gap-1">
    <button className="h-9 rounded-lg border px-3 disabled:opacity-40" disabled={meta.currentPage === 1} onClick={() => onPage(meta.currentPage - 1)}>‹</button>
    {pages.map((page, index) => <span key={page} className="contents">{index > 0 && page - pages[index - 1] > 1 && <span className="px-1 py-2">…</span>}<button className={`h-9 min-w-9 rounded-lg border px-2 ${page === meta.currentPage ? 'border-blue-600 bg-blue-600 text-white' : 'bg-white'}`} onClick={() => onPage(page)}>{page}</button></span>)}
    <button className="h-9 rounded-lg border px-3 disabled:opacity-40" disabled={meta.currentPage === meta.lastPage} onClick={() => onPage(meta.currentPage + 1)}>›</button>
  </div>;
}
