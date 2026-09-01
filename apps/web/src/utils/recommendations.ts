import { hashOrderId } from '@/utils/tracking';
import { getMatchQuality } from '@/utils/textMatch';
import { products as allProducts } from '@/data/products';
import type { Product } from '@/types/product';
import type { UserSignals } from '@/hooks/useUserSignals';

/**
 * Complementary-category chain for "Frequently Bought Together." This
 * catalog has 3 categories (Plants/Vessels/Tools) — not the specific
 * Fertilizer/Plant Food/Decorative Pebbles chain from the brief, which
 * doesn't map onto any product actually in this catalog. This applies the
 * same *pattern* (a plant needs a vessel and care tools) to what exists,
 * documented rather than silently substituted.
 */
const complementaryCategories: Record<string, string[]> = {
  plants: ['vessels', 'tools'],
  vessels: ['plants', 'tools'],
  tools: ['plants', 'vessels'],
};

/** Deterministically picks one product from `candidates`, seeded by `seed`. */
function pickDeterministic(candidates: Product[], seed: string): Product | undefined {
  if (candidates.length === 0) return undefined;
  const index = hashOrderId(seed) % candidates.length;
  return candidates[index];
}

export function getFrequentlyBoughtTogether(product: Product, count = 2): Product[] {
  const complementarySlugs = complementaryCategories[product.categorySlug] ?? [];
  const picks: Product[] = [];
  for (const categorySlug of complementarySlugs) {
    const candidates = allProducts.filter((p) => p.categorySlug === categorySlug && p.id !== product.id);
    const pick = pickDeterministic(candidates, `${product.id}::${categorySlug}`);
    if (pick) picks.push(pick);
  }
  return picks.slice(0, count);
}

/** Similarity against a reference product — category, price proximity, care-level, rating. Closest proxies this catalog has for "tags, color, size," which it doesn't track as real fields. */
function scoreSimilarity(product: Product, reference: Product): number {
  let score = 0;
  if (product.categorySlug === reference.categorySlug) score += 500;
  const priceDiff = Math.abs(product.price - reference.price);
  score += Math.max(0, 200 - priceDiff * 2);
  if (product.careLevel && product.careLevel === reference.careLevel) score += 100;
  score += (product.rating ?? 0) * 10;
  return score;
}

export function getSimilarProducts(product: Product, count = 4): Product[] {
  return allProducts
    .filter((p) => p.id !== product.id)
    .map((p) => ({ product: p, score: scoreSimilarity(p, product) }))
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id))
    .slice(0, count)
    .map((x) => x.product);
}

/**
 * Mocks "customers who viewed this also viewed that" — no real
 * cross-customer data exists behind this, so it's a deterministic
 * pseudo-selection seeded by the product id. Pulls from any category to
 * feel distinct from the same-category "Similar Products" section.
 */
export function getCustomersAlsoViewed(product: Product, count = 4): Product[] {
  const candidates = allProducts.filter((p) => p.id !== product.id);
  return [...candidates]
    .sort((a, b) => hashOrderId(`${product.id}::${a.id}`) - hashOrderId(`${product.id}::${b.id}`))
    .slice(0, count);
}

/** Complements for everything currently in a cart, deduplicated, excluding items already in the cart. */
export function getCartComplements(cartProductIds: string[], count = 4): Product[] {
  const cartProducts = allProducts.filter((p) => cartProductIds.includes(p.id));
  const suggestions = new Map<string, Product>();
  for (const product of cartProducts) {
    for (const suggestion of getFrequentlyBoughtTogether(product, 2)) {
      if (!cartProductIds.includes(suggestion.id)) suggestions.set(suggestion.id, suggestion);
    }
  }
  return [...suggestions.values()].slice(0, count);
}

/**
 * Personalized recommendations from wishlist/recently-viewed/purchase/
 * search-history signals — favorite categories derived by weighted
 * frequency, boosted by search-term matches, penalized for items already
 * seen. Deterministic: a pure function of the signals passed in. Guests
 * with no signals fall back to bestsellers.
 */
export function getPersonalizedRecommendations(signals: UserSignals, count = 8): Product[] {
  const hasSignals =
    signals.wishlistIds.length > 0 ||
    signals.recentlyViewedIds.length > 0 ||
    signals.purchasedProductIds.length > 0 ||
    signals.recentSearches.length > 0;

  const purchasedSet = new Set(signals.purchasedProductIds);
  const candidates = allProducts.filter((p) => !purchasedSet.has(p.id));

  if (!hasSignals) {
    return candidates.filter((p) => p.badge === 'Bestseller').slice(0, count);
  }

  const categoryWeight = new Map<string, number>();
  function bump(productId: string, weight: number) {
    const product = allProducts.find((p) => p.id === productId);
    if (product) categoryWeight.set(product.categorySlug, (categoryWeight.get(product.categorySlug) ?? 0) + weight);
  }
  signals.wishlistIds.forEach((id) => bump(id, 3));
  signals.recentlyViewedIds.forEach((id) => bump(id, 2));
  signals.purchasedProductIds.forEach((id) => bump(id, 4));

  const alreadySeen = new Set([...signals.wishlistIds, ...signals.recentlyViewedIds]);

  const scored = candidates
    .filter((p) => !alreadySeen.has(p.id))
    .map((p) => {
      let score = (categoryWeight.get(p.categorySlug) ?? 0) * 50;
      const searchMatch = signals.recentSearches.some(
        (term) => getMatchQuality(p.name, term) !== 'none' || getMatchQuality(p.category, term) !== 'none'
      );
      if (searchMatch) score += 300;
      if (p.badge === 'Bestseller') score += 150;
      score += (p.rating ?? 0) * 10;
      return { product: p, score };
    });

  return scored
    .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id))
    .slice(0, count)
    .map((x) => x.product);
}
