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
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1.5 sm:mt-12">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
        className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-ink-soft transition-colors hover:bg-stone-dark hover:text-heading disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft size={18} />
      </button>

      <span className="min-w-32 px-2 text-center text-[15px] tabular-nums text-ink-soft sm:hidden" aria-live="polite">
        Page {page} of {totalPages}
      </span>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="hidden px-2 text-sm text-ink-soft sm:inline">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
            className={cn(
              'hidden size-11 rounded-[var(--radius-control)] text-[15px] tabular-nums transition-colors sm:block',
              p === page ? 'bg-pine text-cream-light' : 'text-ink-soft hover:bg-stone-dark hover:text-heading'
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
        className="flex size-11 items-center justify-center rounded-[var(--radius-control)] text-ink-soft transition-colors hover:bg-stone-dark hover:text-heading disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
