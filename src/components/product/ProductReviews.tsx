import { Star } from 'lucide-react';
import { useReviews } from '@/hooks/useReviews';
import { EmptyState } from '@/components/common/EmptyState';
import { Tag } from '@/components/ui/Tag';

interface ProductReviewsProps {
  productId: string;
  averageRating?: number;
  reviewCount?: number;
}

function RatingBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-ink-soft">
      <span className="w-8 font-mono">{stars}★</span>
      <div className="flex-1 h-1.5 rounded-full bg-stone-dark overflow-hidden">
        <div className="h-full bg-ochre" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-6 text-right font-mono">{count}</span>
    </div>
  );
}

export function ProductReviews({ productId, averageRating, reviewCount }: ProductReviewsProps) {
  const { data: reviews, isLoading } = useReviews(productId);

  const breakdown = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews?.filter((r) => r.rating === stars).length ?? 0,
  }));

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-stone-dark/40 rounded-[var(--radius-card)]" />;
  }

  if (!reviews || reviews.length === 0) {
    return (
      <EmptyState
        title="No reviews yet"
        description="Be the first to review this product after your order arrives."
      />
    );
  }

  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-10">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-4xl font-semibold text-heading">{averageRating ?? '—'}</span>
          <div>
            <div className="flex text-ochre">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={14} className={i < Math.round(averageRating ?? 0) ? 'fill-ochre' : ''} />
              ))}
            </div>
            <p className="text-xs text-ink-soft mt-0.5">{reviewCount ?? reviews.length} reviews</p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mt-5">
          {breakdown.map((b) => (
            <RatingBar key={b.stars} stars={b.stars} count={b.count} total={reviews.length} />
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-6">
        {reviews.map((review) => (
          <li key={review.id} className="border-b border-stone-dark pb-6 last:border-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex text-ochre">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={13} className={i < review.rating ? 'fill-ochre' : ''} />
                ))}
              </div>
              {review.verified && <Tag tone="stone">Verified</Tag>}
            </div>
            <h4 className="font-medium text-ink mt-2">{review.title}</h4>
            <p className="text-sm text-ink-soft mt-1">{review.body}</p>
            <p className="font-mono text-xs text-ink-soft/70 mt-2">
              {review.author} — {review.date}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
