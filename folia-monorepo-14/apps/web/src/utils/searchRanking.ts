import { getMatchQuality } from '@/utils/textMatch';
import type { Product } from '@/types/product';

export interface RankingContext {
  recentlyViewedIds?: string[];
  wishlistIds?: string[];
  purchasedProductIds?: string[];
  trendingProductIds?: string[];
}

const WEIGHTS = {
  exactMatch: 10000,
  prefixMatch: 5000,
  categoryMatch: 800,
  bestseller: 400,
  recentlyViewed: 300,
  wishlist: 300,
  purchased: 350,
  trending: 200,
  ratingMultiplier: 20,
};

/**
 * Deterministic relevance score for a product against a search query, given
 * the searching person's own signals. Pure function — same inputs always
 * produce the same score. Used by the search overlay. Query-driven (exact/
 * prefix match against a typed term), so it isn't a fit for the
 * recommendation engine's query-less scoring — utils/recommendations.ts has
 * its own scoring functions for that, sharing only getMatchQuality
 * (textMatch.ts) with this file, not this function.
 */
export function scoreProduct(product: Product, query: string, context: RankingContext = {}): number {
  let score = 0;

  const nameQuality = getMatchQuality(product.name, query);
  if (nameQuality === 'exact') score += WEIGHTS.exactMatch;
  else if (nameQuality === 'prefix') score += WEIGHTS.prefixMatch;

  if (getMatchQuality(product.category, query) !== 'none') score += WEIGHTS.categoryMatch;

  if (product.badge === 'Bestseller') score += WEIGHTS.bestseller;
  if (context.recentlyViewedIds?.includes(product.id)) score += WEIGHTS.recentlyViewed;
  if (context.wishlistIds?.includes(product.id)) score += WEIGHTS.wishlist;
  if (context.purchasedProductIds?.includes(product.id)) score += WEIGHTS.purchased;
  if (context.trendingProductIds?.includes(product.id)) score += WEIGHTS.trending;

  score += (product.rating ?? 0) * WEIGHTS.ratingMultiplier;

  return score;
}

/** Ranks and sorts products by scoreProduct, highest first. Ties broken by product id for full determinism. */
export function rankProducts(products: Product[], query: string, context: RankingContext = {}): Product[] {
  return [...products]
    .map((product) => ({ product, score: scoreProduct(product, query, context) }))
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id))
    .map((x) => x.product);
}
