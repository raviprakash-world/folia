import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createReview, fetchReviews } from '@/services/reviewService';
import type { CreateReviewInput } from '@/services/reviewService';

export function useReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => fetchReviews(productId!),
    enabled: !!productId,
  });
}

/** Marketplace Phase 16 — also invalidates the product query, since a real review write recomputes Product.rating/reviewCount server-side (ReviewsService.createReview) and this page's own rating summary reads those off the cached product, not off the reviews list. */
export function useCreateReview(productId: string, productSlug: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateReviewInput, 'productId'>) =>
      createReview({ ...input, productId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      if (productSlug) void queryClient.invalidateQueries({ queryKey: ['product', productSlug] });
    },
  });
}
