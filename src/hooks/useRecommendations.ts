import { useMemo } from 'react';
import { useUserSignals } from '@/hooks/useUserSignals';
import { useCartStore } from '@/store/cartStore';
import {
  getSimilarProducts,
  getFrequentlyBoughtTogether,
  getCustomersAlsoViewed,
  getPersonalizedRecommendations,
  getCartComplements,
} from '@/utils/recommendations';
import type { Product } from '@/types/product';

export function useSimilarProducts(product: Product | undefined, count = 4) {
  return useMemo(() => (product ? getSimilarProducts(product, count) : []), [product, count]);
}

export function useFrequentlyBoughtTogether(product: Product | undefined, count = 2) {
  return useMemo(() => (product ? getFrequentlyBoughtTogether(product, count) : []), [product, count]);
}

export function useCustomersAlsoViewed(product: Product | undefined, count = 4) {
  return useMemo(() => (product ? getCustomersAlsoViewed(product, count) : []), [product, count]);
}

export function usePersonalizedRecommendations(count = 8) {
  const signals = useUserSignals();
  return useMemo(() => getPersonalizedRecommendations(signals, count), [signals, count]);
}

export function useCartComplements(count = 4) {
  const cartItems = useCartStore((s) => s.items);
  const cartProductIds = useMemo(() => cartItems.map((i) => i.productId), [cartItems]);
  return useMemo(() => getCartComplements(cartProductIds, count), [cartProductIds, count]);
}
