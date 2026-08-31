import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useProducts } from '@/hooks/useProducts';
import { useUserSignals } from '@/hooks/useUserSignals';
import { rankProducts } from '@/utils/searchRanking';
import { sortByRelevance, findDidYouMean } from '@/utils/textMatch';
import { categories, collections } from '@/data/categories';
import { blogPosts } from '@/data/blog';
import { products as allProducts } from '@/data/products';
import { trending } from '@/data/homepage';
import { fetchRealSearch } from '@/services/searchApiService';

const DEBOUNCE_MS = 250;
const PRODUCT_RESULT_LIMIT = 6;
const useRealSearchApi = import.meta.env.VITE_REAL_SEARCH_API === 'true';

/**
 * Blog posts are matched client-side unconditionally, regardless of
 * this flag — blog isn't a real backend concept at all (confirmed
 * directly against the schema, Phase 7), so there's no server
 * equivalent to switch to even when the flag is on.
 */
function useBlogMatches(trimmed: string) {
  return useMemo(
    () => (trimmed ? sortByRelevance(blogPosts, trimmed, (p) => p.title).slice(0, 3) : []),
    [trimmed]
  );
}

export function useSearchResults(rawQuery: string) {
  const query = useDebouncedValue(rawQuery, DEBOUNCE_MS);
  const trimmed = query.trim();
  const matchedBlogPosts = useBlogMatches(trimmed);

  // Both hooks are always called, unconditionally — required by the
  // Rules of Hooks, even though useRealSearchApi is a build-time
  // constant that never actually changes mid-session. Each hook is
  // internally gated (via its own `enabled`) so only the selected path
  // actually fires a network request; the other's query stays idle.
  const real = useRealSearchResults(trimmed, matchedBlogPosts, useRealSearchApi);
  const local = useLocalSearchResults(trimmed, matchedBlogPosts, !useRealSearchApi);
  return useRealSearchApi ? real : local;
}

/**
 * Real backend path — the dedicated /search endpoint (Phase 7) does the
 * same product/category ranking server-side, using real wishlist and
 * purchase-history signals for authenticated users instead of this
 * hook's local useUserSignals() heuristics. No separate product-total
 * count exists in this response (unlike the client-side path's
 * productPage.total), so productTotal here is just products.length —
 * a real, honest difference in what's available, not a bug.
 */
function useRealSearchResults(
  trimmed: string,
  matchedBlogPosts: ReturnType<typeof useBlogMatches>,
  isEnabled: boolean
) {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['real-search', trimmed],
    queryFn: () => fetchRealSearch(trimmed),
    enabled: isEnabled && trimmed.length > 0,
  });

  const totalResultCount = (data?.products.length ?? 0) + (data?.categories.length ?? 0) + matchedBlogPosts.length;

  return {
    query: trimmed,
    isLoading: isLoading && trimmed.length > 0,
    products: data?.products.slice(0, PRODUCT_RESULT_LIMIT) ?? [],
    productTotal: data?.products.length ?? 0,
    matchedCategories: data?.categories ?? [],
    matchedBlogPosts,
    totalResultCount,
    didYouMean: isFetching ? null : (data?.didYouMean ?? null),
    fallbackTrendingProducts: trending,
  };
}

/** Original client-side path — unchanged from before this flag existed. */
function useLocalSearchResults(
  trimmed: string,
  matchedBlogPosts: ReturnType<typeof useBlogMatches>,
  isEnabled: boolean
) {
  const { wishlistIds, recentlyViewedIds, purchasedProductIds } = useUserSignals();
  const trendingProductIds = useMemo(() => trending.map((p) => p.id), []);

  const {
    data: productPage,
    isLoading: productsLoading,
    isFetching: productsFetching,
  } = useProducts({ search: trimmed, pageSize: 20 }, { enabled: isEnabled && trimmed.length > 0 });

  const rankedProducts = useMemo(() => {
    if (!productPage) return [];
    return rankProducts(productPage.items, trimmed, {
      wishlistIds,
      recentlyViewedIds,
      purchasedProductIds,
      trendingProductIds,
    }).slice(0, PRODUCT_RESULT_LIMIT);
  }, [productPage, trimmed, wishlistIds, recentlyViewedIds, purchasedProductIds, trendingProductIds]);

  const matchedCategories = useMemo(
    () => (trimmed ? sortByRelevance([...categories, ...collections], trimmed, (c) => c.name).slice(0, 4) : []),
    [trimmed]
  );

  const totalResultCount = rankedProducts.length + matchedCategories.length + matchedBlogPosts.length;

  const didYouMean = useMemo(() => {
    if (!trimmed || totalResultCount > 0 || productsFetching) return null;
    const candidates = [
      ...allProducts.map((p) => p.name),
      ...categories.map((c) => c.name),
      ...collections.map((c) => c.name),
    ];
    return findDidYouMean(trimmed, candidates);
  }, [trimmed, totalResultCount, productsFetching]);

  return {
    query: trimmed,
    isLoading: productsLoading && trimmed.length > 0,
    products: rankedProducts,
    productTotal: productPage?.total ?? 0,
    matchedCategories,
    matchedBlogPosts,
    totalResultCount,
    didYouMean,
    fallbackTrendingProducts: trending,
  };
}
