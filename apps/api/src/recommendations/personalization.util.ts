import { getMatchQuality } from '../search/text-match.util';

export interface PersonalizableProduct {
  id: string;
  name: string;
  category: string;
  badge?: string;
  rating?: number;
}

export interface UserSignals {
  wishlistIds: string[];
  recentlyViewedIds: string[];
  purchasedProductIds: string[];
  recentSearches: string[];
}

/**
 * Mirrors apps/web/src/utils/recommendations.ts's getPersonalizedRecommendations
 * exactly — same weighted category-affinity approach, same bestseller
 * fallback for signal-less (guest, new) callers. wishlistIds/
 * purchasedProductIds are real backend data for an authenticated caller
 * here (RecommendationsController), not just whatever the client happens
 * to have loaded locally — same upgrade already made for search ranking
 * in Phase 7.
 */
export function rankPersonalized<T extends PersonalizableProduct>(
  candidates: T[],
  signals: UserSignals,
  count = 8,
): T[] {
  const hasSignals =
    signals.wishlistIds.length > 0 ||
    signals.recentlyViewedIds.length > 0 ||
    signals.purchasedProductIds.length > 0 ||
    signals.recentSearches.length > 0;

  const purchasedSet = new Set(signals.purchasedProductIds);
  const eligible = candidates.filter((p) => !purchasedSet.has(p.id));

  if (!hasSignals) {
    return eligible.filter((p) => p.badge === 'Bestseller').slice(0, count);
  }

  const categoryWeight = new Map<string, number>();
  const byId = new Map(candidates.map((p) => [p.id, p]));
  function bump(productId: string, weight: number) {
    const product = byId.get(productId);
    if (product)
      categoryWeight.set(
        product.category,
        (categoryWeight.get(product.category) ?? 0) + weight,
      );
  }
  signals.wishlistIds.forEach((id) => bump(id, 3));
  signals.recentlyViewedIds.forEach((id) => bump(id, 2));
  signals.purchasedProductIds.forEach((id) => bump(id, 4));

  const alreadySeen = new Set([
    ...signals.wishlistIds,
    ...signals.recentlyViewedIds,
  ]);

  const scored = eligible
    .filter((p) => !alreadySeen.has(p.id))
    .map((p) => {
      let score = (categoryWeight.get(p.category) ?? 0) * 50;
      const searchMatch = signals.recentSearches.some(
        (term) =>
          getMatchQuality(p.name, term) !== 'none' ||
          getMatchQuality(p.category, term) !== 'none',
      );
      if (searchMatch) score += 300;
      if (p.badge === 'Bestseller') score += 150;
      score += (p.rating ?? 0) * 10;
      return { product: p, score };
    });

  return scored
    .sort(
      (a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id),
    )
    .slice(0, count)
    .map((x) => x.product);
}
