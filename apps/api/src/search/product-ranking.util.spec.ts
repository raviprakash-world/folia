import { rankProducts, scoreProduct } from './product-ranking.util';
import type { RankableProduct } from './product-ranking.util';

function makeProduct(
  overrides: Partial<RankableProduct> = {},
): RankableProduct {
  return {
    id: 'prod-1',
    name: 'Monstera Deliciosa',
    category: 'Plants',
    ...overrides,
  };
}

describe('scoreProduct', () => {
  it('scores an exact name match higher than a prefix match', () => {
    const exact = scoreProduct(makeProduct({ name: 'Monstera' }), 'monstera');
    const prefix = scoreProduct(
      makeProduct({ name: 'Monstera Deliciosa' }),
      'monstera',
    );
    expect(exact).toBeGreaterThan(prefix);
  });

  it('adds a category-match bonus separately from the name match', () => {
    const withCategoryMatch = scoreProduct(
      makeProduct({ name: 'Fern', category: 'Plants' }),
      'plants',
    );
    const withoutMatch = scoreProduct(
      makeProduct({ name: 'Fern', category: 'Tools' }),
      'plants',
    );
    expect(withCategoryMatch).toBeGreaterThan(withoutMatch);
  });

  it('gives a bestseller bonus', () => {
    const bestseller = scoreProduct(
      makeProduct({ badge: 'Bestseller' }),
      'monstera',
    );
    const regular = scoreProduct(makeProduct({ badge: undefined }), 'monstera');
    expect(bestseller).toBeGreaterThan(regular);
  });

  it('boosts a product the caller has wishlisted', () => {
    const wishlisted = scoreProduct(makeProduct(), 'monstera', {
      wishlistIds: ['prod-1'],
    });
    const notWishlisted = scoreProduct(makeProduct(), 'monstera', {
      wishlistIds: ['prod-2'],
    });
    expect(wishlisted).toBeGreaterThan(notWishlisted);
  });

  it('boosts a product the caller has actually purchased, weighted more than a mere wishlist entry', () => {
    const purchased = scoreProduct(makeProduct(), 'monstera', {
      purchasedProductIds: ['prod-1'],
    });
    const wishlisted = scoreProduct(makeProduct(), 'monstera', {
      wishlistIds: ['prod-1'],
    });
    expect(purchased).toBeGreaterThan(wishlisted);
  });

  it('factors in rating as a real, multiplied contribution', () => {
    const highRated = scoreProduct(makeProduct({ rating: 5 }), 'monstera');
    const lowRated = scoreProduct(makeProduct({ rating: 1 }), 'monstera');
    expect(highRated - lowRated).toBe(4 * 20); // ratingMultiplier
  });
});

describe('rankProducts', () => {
  it('sorts highest score first', () => {
    const products = [
      makeProduct({ id: 'a', name: 'Ceramic Pot', category: 'Vessels' }),
      makeProduct({ id: 'b', name: 'Monstera', category: 'Plants' }),
    ];
    const result = rankProducts(products, 'monstera');
    expect(result[0]?.id).toBe('b'); // exact match wins over no match
  });

  it('breaks ties deterministically by product id', () => {
    const products = [
      makeProduct({ id: 'zzz', name: 'Monstera', category: 'Plants' }),
      makeProduct({ id: 'aaa', name: 'Monstera', category: 'Plants' }),
    ];
    const result = rankProducts(products, 'monstera');
    expect(result[0]?.id).toBe('aaa'); // identical scores, 'aaa' sorts first
  });

  it('does not mutate the original array', () => {
    const products = [makeProduct({ id: 'a' }), makeProduct({ id: 'b' })];
    const original = [...products];
    rankProducts(products, 'monstera');
    expect(products).toEqual(original);
  });
});
