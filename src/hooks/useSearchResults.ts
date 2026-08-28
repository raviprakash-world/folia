import { useMemo } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useProducts } from '@/hooks/useProducts';
import { useUserSignals } from '@/hooks/useUserSignals';
import { rankProducts } from '@/utils/searchRanking';
import { sortByRelevance, findDidYouMean } from '@/utils/textMatch';
import { categories, collections } from '@/data/categories';
import { blogPosts } from '@/data/blog';
import { products as allProducts } from '@/data/products';
import { trending } from '@/data/homepage';

const DEBOUNCE_MS = 250;
const PRODUCT_RESULT_LIMIT = 6;

export function useSearchResults(rawQuery: string) {
  const query = useDebouncedValue(rawQuery, DEBOUNCE_MS);
  const trimmed = query.trim();

  const { wishlistIds, recentlyViewedIds, purchasedProductIds } = useUserSignals();
  const trendingProductIds = useMemo(() => trending.map((p) => p.id), []);

  const {
    data: productPage,
    isLoading: productsLoading,
    isFetching: productsFetching,
  } = useProducts({ search: trimmed, pageSize: 20 }, { enabled: trimmed.length > 0 });

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

  const matchedBlogPosts = useMemo(
    () => (trimmed ? sortByRelevance(blogPosts, trimmed, (p) => p.title).slice(0, 3) : []),
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
