import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUserSignals } from '@/hooks/useUserSignals';
import { useCartStore } from '@/store/cartStore';
import {
  getSimilarProducts,
  getFrequentlyBoughtTogether,
  getCustomersAlsoViewed,
  getPersonalizedRecommendations,
  getCartComplements,
} from '@/utils/recommendations';
import {
  fetchRealSimilarProducts,
  fetchRealFrequentlyBoughtTogether,
  fetchRealPersonalizedRecommendations,
} from '@/services/recommendationsApiService';
import type { Product } from '@/types/product';

const useRealRecommendationsApi = import.meta.env.VITE_REAL_RECOMMENDATIONS_API === 'true';

/**
 * Only similar/frequently-bought-together/personalized have a real
 * backend equivalent — a stated scope cut, not an oversight.
 * useCustomersAlsoViewed and useCartComplements stay client-side-only
 * regardless of this flag, since RecommendationsController has no
 * matching endpoint for either concept (confirmed directly against the
 * source before writing this).
 */
export function useSimilarProducts(product: Product | undefined, count = 4) {
  const local = useMemo(
    () => (!useRealRecommendationsApi && product ? getSimilarProducts(product, count) : []),
    [product, count]
  );
  const { data: real } = useQuery({
    queryKey: ['real-similar', product?.id],
    queryFn: () => fetchRealSimilarProducts(product!.id),
    enabled: useRealRecommendationsApi && !!product,
  });
  return useRealRecommendationsApi ? (real ?? []) : local;
}

export function useFrequentlyBoughtTogether(product: Product | undefined, count = 2) {
  const local = useMemo(
    () => (!useRealRecommendationsApi && product ? getFrequentlyBoughtTogether(product, count) : []),
    [product, count]
  );
  const { data: real } = useQuery({
    queryKey: ['real-fbt', product?.id],
    queryFn: () => fetchRealFrequentlyBoughtTogether(product!.id),
    enabled: useRealRecommendationsApi && !!product,
  });
  return useRealRecommendationsApi ? (real ?? []) : local;
}

export function useCustomersAlsoViewed(product: Product | undefined, count = 4) {
  return useMemo(() => (product ? getCustomersAlsoViewed(product, count) : []), [product, count]);
}

export function usePersonalizedRecommendations(count = 8) {
  const signals = useUserSignals();
  const local = useMemo(
    () => (useRealRecommendationsApi ? [] : getPersonalizedRecommendations(signals, count)),
    [signals, count]
  );
  const { data: real } = useQuery({
    queryKey: ['real-personalized', signals.recentlyViewedIds, signals.recentSearches],
    queryFn: () => fetchRealPersonalizedRecommendations(signals.recentlyViewedIds, signals.recentSearches),
    enabled: useRealRecommendationsApi,
  });
  return useRealRecommendationsApi ? (real ?? []) : local;
}

export function useCartComplements(count = 4) {
  const cartItems = useCartStore((s) => s.items);
  const cartProductIds = useMemo(() => cartItems.map((i) => i.productId), [cartItems]);
  return useMemo(() => getCartComplements(cartProductIds, count), [cartProductIds, count]);
}
