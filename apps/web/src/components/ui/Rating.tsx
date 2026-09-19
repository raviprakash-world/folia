import { Star } from 'lucide-react';
import { cn } from '@/utils/cn';

interface RatingProps {
  rating?: number;
  count?: number;
  className?: string;
}

/** Shown only when there is a real rating backed by at least one review. */
export function Rating({ rating, count, className }: RatingProps) {
  if (!rating || !count) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-ink-soft', className)}>
      <Star size={12} aria-hidden="true" className="fill-ochre text-ochre" />
      <span className="font-medium text-ink">{rating}</span>
      <span>({count})</span>
      <span className="sr-only">
        rated {rating} out of 5 from {count} {count === 1 ? 'review' : 'reviews'}
      </span>
    </span>
  );
}
