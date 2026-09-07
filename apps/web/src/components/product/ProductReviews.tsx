import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { useReviews, useCreateReview } from '@/hooks/useReviews';
import { useAuthStore } from '@/store/authStore';
import { EmptyState } from '@/components/common/EmptyState';
import { Alert } from '@/components/common/Alert';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Tag';

interface ProductReviewsProps {
  productId: string;
  productSlug: string;
  averageRating?: number;
  reviewCount?: number;
}

const writeReviewSchema = z.object({
  rating: z.number().min(1, 'Choose a star rating').max(5),
  title: z.string().min(1, 'Enter a title').max(120),
  body: z.string().min(1, 'Enter a review').max(2000),
});
type WriteReviewValues = z.infer<typeof writeReviewSchema>;

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          onClick={() => onChange(star)}
          className="text-ochre"
        >
          <Star size={22} className={star <= value ? 'fill-ochre' : ''} />
        </button>
      ))}
    </div>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function WriteReviewForm({ productId, productSlug }: { productId: string; productSlug: string }) {
  const createReview = useCreateReview(productId, productSlug);
  const [submitted, setSubmitted] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WriteReviewValues>({
    resolver: zodResolver(writeReviewSchema),
    defaultValues: { rating: 0, title: '', body: '' },
  });

  async function onSubmit(values: WriteReviewValues) {
    await createReview.mutateAsync({ ...values, rating: values.rating as 1 | 2 | 3 | 4 | 5 });
    reset({ rating: 0, title: '', body: '' });
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Alert tone="success" className="mb-8">
        Thanks — your review is live.
      </Alert>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-4 mb-10 max-w-lg" noValidate>
      <h3 className="font-display text-base font-semibold text-heading">Write a review</h3>
      <Controller
        control={control}
        name="rating"
        render={({ field }) => <StarPicker value={field.value} onChange={field.onChange} />}
      />
      {errors.rating && (
        <p role="alert" className="text-xs text-rust -mt-2">
          {errors.rating.message}
        </p>
      )}
      <FormField label="Title" error={errors.title?.message} {...register('title')} />
      <FormField as="textarea" rows={3} label="Your review" error={errors.body?.message} {...register('body')} />
      {createReview.isError && <Alert tone="error">{errorMessage(createReview.error, "Couldn't submit your review.")}</Alert>}
      <Button type="submit" variant="primary" disabled={createReview.isPending} className="self-start">
        {createReview.isPending ? 'Submitting…' : 'Submit review'}
      </Button>
    </form>
  );
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

export function ProductReviews({ productId, productSlug, averageRating, reviewCount }: ProductReviewsProps) {
  const { data: reviews, isLoading } = useReviews(productId);
  const user = useAuthStore((s) => s.user);

  const breakdown = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews?.filter((r) => r.rating === stars).length ?? 0,
  }));

  const writeReviewSection = user ? (
    <WriteReviewForm productId={productId} productSlug={productSlug} />
  ) : (
    <p className="text-sm text-ink-soft mb-10">
      <Link to="/account/login" className="text-fern underline">
        Log in
      </Link>{' '}
      to write a review after your order arrives.
    </p>
  );

  if (isLoading) {
    return <div className="animate-pulse h-40 bg-stone-dark/40 rounded-[var(--radius-card)]" />;
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div>
        {writeReviewSection}
        <EmptyState
          title="No reviews yet"
          description="Be the first to review this product after your order arrives."
        />
      </div>
    );
  }

  return (
    <div>
      {writeReviewSection}
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
    </div>
  );
}
