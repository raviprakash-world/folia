import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type TagTone = 'pine' | 'ochre' | 'rust' | 'stone';

interface TagProps {
  children: ReactNode;
  tone?: TagTone;
  /** Subtle rotation gives it the hand-tied nursery-label feel. Off by default so dense grids stay calm. */
  tilted?: boolean;
  className?: string;
}

const toneStyles: Record<TagTone, string> = {
  pine: 'bg-pine text-stone-light',
  ochre: 'bg-ochre text-heading',
  rust: 'bg-rust text-rust-light',
  stone: 'bg-stone-dark text-ink',
};

/**
 * Folia's signature element: a small die-cut label referencing physical plant
 * tags. Used for category badges, "new" / "sale" markers, and price tags on
 * product cards. Deliberately not a generic pill — has a notch cut into one
 * side, like a punched paper tag.
 */
export function Tag({ children, tone = 'pine', tilted = false, className }: TagProps) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center gap-1 pl-3 pr-2.5 py-1',
        'font-mono text-xs tracking-wide uppercase',
        'rounded-[var(--radius-tag)] shadow-[var(--shadow-tag)]',
        tilted && '-rotate-2',
        toneStyles[tone],
        className
      )}
    >
      {/* punched hole, like a tied nursery tag */}
      <span
        aria-hidden="true"
        className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-stone"
      />
      {children}
    </span>
  );
}
