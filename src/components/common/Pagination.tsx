import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function getPageList(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | 'ellipsis')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) result.push('ellipsis');
    result.push(p);
  });
  return result;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const pages = getPageList(page, totalPages);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 mt-12">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="p-2 rounded-[var(--radius-control)] text-ink-soft hover:text-heading hover:bg-stone-dark disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <ChevronLeft size={18} />
      </button>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-ink-soft/50 font-mono text-sm">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'w-9 h-9 rounded-[var(--radius-control)] font-mono text-sm transition-colors',
              p === page ? 'bg-pine text-stone-light' : 'text-ink-soft hover:bg-stone-dark hover:text-heading'
            )}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
        className="p-2 rounded-[var(--radius-control)] text-ink-soft hover:text-heading hover:bg-stone-dark disabled:opacity-30 disabled:pointer-events-none transition-colors"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
