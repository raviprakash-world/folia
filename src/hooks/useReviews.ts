import { useQuery } from '@tanstack/react-query';
import { fetchReviews } from '@/services/reviewService';

export function useReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => fetchReviews(productId!),
    enabled: !!productId,
  });
}
