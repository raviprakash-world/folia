import { getMatchQuality } from './text-match.util';

export interface RankableProduct {
  id: string;
  name: string;
  category: string;
  badge?: string;
  rating?: number;
}

export interface RankingContext {
  recentlyViewedIds?: string[];
  wishlistIds?: string[];
  purchasedProductIds?: string[];
  trendingProductIds?: string[];
}

/** Mirrors apps/web/src/utils/searchRanking.ts's WEIGHTS exactly. */
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
 * Mirrors apps/web/src/utils/searchRanking.ts's scoreProduct exactly —
 * same weights, same signals. The one real upgrade over the frontend's
 * version: wishlistIds/purchasedProductIds can now come from genuine
 * server-side data (WishlistService, real order history) for an
 * authenticated caller, rather than only whatever the client already had
 * loaded locally — see SearchService.
 */
export function scoreProduct(
  product: RankableProduct,
  query: string,
  context: RankingContext = {},
): number {
  let score = 0;

  const nameQuality = getMatchQuality(product.name, query);
  if (nameQuality === 'exact') score += WEIGHTS.exactMatch;
  else if (nameQuality === 'prefix') score += WEIGHTS.prefixMatch;

  if (getMatchQuality(product.category, query) !== 'none')
    score += WEIGHTS.categoryMatch;

  if (product.badge === 'Bestseller') score += WEIGHTS.bestseller;
  if (context.recentlyViewedIds?.includes(product.id))
    score += WEIGHTS.recentlyViewed;
  if (context.wishlistIds?.includes(product.id)) score += WEIGHTS.wishlist;
  if (context.purchasedProductIds?.includes(product.id))
    score += WEIGHTS.purchased;
  if (context.trendingProductIds?.includes(product.id))
    score += WEIGHTS.trending;

  score += (product.rating ?? 0) * WEIGHTS.ratingMultiplier;

  return score;
}

/** Ranks and sorts products by scoreProduct, highest first. Ties broken by product id for full determinism, matching the frontend exactly. */
export function rankProducts<T extends RankableProduct>(
  products: T[],
  query: string,
  context: RankingContext = {},
): T[] {
  return [...products]
    .map((product) => ({
      product,
      score: scoreProduct(product, query, context),
    }))
    .sort(
      (a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id),
    )
    .map((x) => x.product);
}
