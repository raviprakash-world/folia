import { rankPersonalized } from './personalization.util';
import type { PersonalizableProduct } from './personalization.util';

function makeProduct(
  overrides: Partial<PersonalizableProduct> = {},
): PersonalizableProduct {
  return { id: 'p1', name: 'Product', category: 'plants', ...overrides };
}

const EMPTY_SIGNALS = {
  wishlistIds: [],
  recentlyViewedIds: [],
  purchasedProductIds: [],
  recentSearches: [],
};

describe('rankPersonalized', () => {
  it('falls back to bestsellers only, for a caller with no signals at all', () => {
    const candidates = [
      makeProduct({ id: 'a', badge: 'Bestseller' }),
      makeProduct({ id: 'b' }),
    ];
    const result = rankPersonalized(candidates, EMPTY_SIGNALS);
    expect(result).toEqual([candidates[0]]);
  });

  it('excludes already-purchased products entirely, even from the bestseller fallback', () => {
    const candidates = [makeProduct({ id: 'a', badge: 'Bestseller' })];
    const result = rankPersonalized(candidates, {
      ...EMPTY_SIGNALS,
      purchasedProductIds: ['a'],
    });
    expect(result).toEqual([]);
  });

  it('boosts products in a category the caller has wishlisted items in', () => {
    const candidates = [
      makeProduct({ id: 'plant-2', category: 'plants' }),
      makeProduct({ id: 'tool-1', category: 'tools' }),
    ];
    // Wishlisted a DIFFERENT plant (not in candidates) — still boosts the plants category generally
    const signals = { ...EMPTY_SIGNALS, wishlistIds: ['some-other-plant-id'] };
    // Need the wishlisted product to be resolvable for category-bumping — include it in candidates too
    const withWishlisted = [
      ...candidates,
      makeProduct({ id: 'some-other-plant-id', category: 'plants' }),
    ];
    const result = rankPersonalized(withWishlisted, signals);
    expect(result[0]?.category).toBe('plants');
  });

  it('never re-recommends a product already in the wishlist or recently viewed', () => {
    const candidates = [makeProduct({ id: 'seen', category: 'plants' })];
    const signals = { ...EMPTY_SIGNALS, wishlistIds: ['seen'] };
    const result = rankPersonalized(candidates, signals);
    expect(result).toEqual([]);
  });

  it('boosts a product matching a recent search term', () => {
    const candidates = [
      makeProduct({ id: 'a', name: 'Snake Plant', category: 'plants' }),
      makeProduct({ id: 'b', name: 'Ceramic Pot', category: 'vessels' }),
    ];
    // Equal category weight via SEPARATE dummy wishlisted products (not
    // 'a'/'b' themselves — wishlisting a candidate excludes it entirely
    // via alreadySeen, which is exactly the bug an earlier version of
    // this test had, discovered by the test itself failing rather than
    // by inspection), so the search-term match is what differentiates.
    const dummyPlant = makeProduct({ id: 'dummy-plant', category: 'plants' });
    const dummyVessel = makeProduct({
      id: 'dummy-vessel',
      category: 'vessels',
    });
    const signals = {
      ...EMPTY_SIGNALS,
      wishlistIds: ['dummy-plant', 'dummy-vessel'],
      recentSearches: ['snake'],
    };
    const result = rankPersonalized(
      [...candidates, dummyPlant, dummyVessel],
      signals,
    );
    expect(result[0]?.id).toBe('a');
  });

  it('weights purchase history more heavily than a mere wishlist entry', () => {
    const purchased = makeProduct({ id: 'bought-plant', category: 'plants' });
    const wishlisted = makeProduct({
      id: 'wishlisted-vessel',
      category: 'vessels',
    });
    const candidate = makeProduct({ id: 'new-plant', category: 'plants' });
    const otherCandidate = makeProduct({
      id: 'new-vessel',
      category: 'vessels',
    });

    const signals = {
      ...EMPTY_SIGNALS,
      purchasedProductIds: ['bought-plant'],
      wishlistIds: ['wishlisted-vessel'],
    };
    const result = rankPersonalized(
      [purchased, wishlisted, candidate, otherCandidate],
      signals,
    );

    // purchased-category (plants, weight 4) should rank above wishlisted-category (vessels, weight 3)
    expect(result[0]?.category).toBe('plants');
  });

  it('respects the count limit', () => {
    const candidates = Array.from({ length: 20 }, (_, i) =>
      makeProduct({ id: `p${i}`, badge: 'Bestseller' }),
    );
    expect(rankPersonalized(candidates, EMPTY_SIGNALS, 5)).toHaveLength(5);
  });
});
