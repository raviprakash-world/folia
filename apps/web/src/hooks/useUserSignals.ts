import { useMemo } from 'react';
import { useWishlistStore } from '@/store/wishlistStore';
import { useRecentlyViewedStore } from '@/store/recentlyViewedStore';
import { useOrderStore } from '@/store/orderStore';
import { useSearchStore } from '@/store/searchStore';

export interface UserSignals {
  wishlistIds: string[];
  recentlyViewedIds: string[];
  purchasedProductIds: string[];
  recentSearches: string[];
}

/** Gathers the signals used for search ranking and product recommendations, from existing stores. */
export function useUserSignals(): UserSignals {
  // Select the raw stable arrays first (Zustand only gives a new reference
  // when the underlying state actually changes) — mapping *inside* the
  // selector would create a new array every render regardless, breaking
  // memoization for every downstream consumer of this hook.
  const wishlistItems = useWishlistStore((s) => s.items);
  const recentlyViewedItems = useRecentlyViewedStore((s) => s.items);
  const orders = useOrderStore((s) => s.orders);
  const recentSearches = useSearchStore((s) => s.recentSearches);

  const wishlistIds = useMemo(() => wishlistItems.map((i) => i.productId), [wishlistItems]);
  const recentlyViewedIds = useMemo(() => recentlyViewedItems.map((i) => i.productId), [recentlyViewedItems]);
  const purchasedProductIds = useMemo(() => orders.flatMap((o) => o.items.map((i) => i.productId)), [orders]);

  return useMemo(
    () => ({ wishlistIds, recentlyViewedIds, purchasedProductIds, recentSearches }),
    [wishlistIds, recentlyViewedIds, purchasedProductIds, recentSearches]
  );
}
