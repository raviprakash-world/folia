import {
  toPublicProduct,
  toPublicCategory,
  toPublicReview,
} from './product.types';
import type {
  ProductRecord,
  CategoryRecord,
  ReviewRecord,
  PrismaDecimal,
} from './product.types';

function decimal(value: number): PrismaDecimal {
  return { toNumber: () => value };
}

function makeProduct(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: 'prod-1',
    slug: 'monstera-deliciosa',
    name: 'Monstera Deliciosa',
    price: decimal(68),
    compareAtPrice: null,
    description: 'Iconic split leaves',
    categoryId: 'cat-plants',
    category: {
      id: 'cat-plants',
      slug: 'plants',
      name: 'Plants',
      description: 'Living plants',
      type: 'CATEGORY',
    },
    badge: 'BESTSELLER',
    careLevel: 'EASY',
    rating: decimal(4.4),
    reviewCount: 18,
    inStock: true,
    stockCount: 10,
    variants: [{ id: 'var-1', label: 'Small', swatch: null, inStock: true }],
    specs: [{ id: 'spec-1', label: 'Light', value: 'Bright indirect' }],
    createdAt: new Date('2026-07-29T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('toPublicProduct', () => {
  it('converts Decimal price/rating to real numbers, not Decimal objects', () => {
    const result = toPublicProduct(makeProduct());
    expect(result.price).toBe(68);
    expect(typeof result.price).toBe('number');
    expect(result.rating).toBe(4.4);
  });

  it('maps enum badge/careLevel to the exact display strings apps/web expects', () => {
    const result = toPublicProduct(
      makeProduct({ badge: 'LOW_STOCK', careLevel: 'ADVANCED' }),
    );
    expect(result.badge).toBe('Low stock');
    expect(result.careLevel).toBe('Advanced');
  });

  it('omits badge/careLevel/compareAtPrice entirely when null, rather than sending null', () => {
    const result = toPublicProduct(
      makeProduct({ badge: null, careLevel: null, compareAtPrice: null }),
    );
    expect(result.badge).toBeUndefined();
    expect(result.careLevel).toBeUndefined();
    expect(result.compareAtPrice).toBeUndefined();
  });

  it('derives category/categorySlug from the related Category record', () => {
    const result = toPublicProduct(makeProduct());
    expect(result.category).toBe('Plants');
    expect(result.categorySlug).toBe('plants');
  });

  it('formats createdAt as a bare date string (YYYY-MM-DD), matching the existing mock data format', () => {
    const result = toPublicProduct(makeProduct());
    expect(result.createdAt).toBe('2026-07-29');
  });

  it('maps variants and specs to their exact public shape', () => {
    const result = toPublicProduct(makeProduct());
    expect(result.variants).toEqual([
      { id: 'var-1', label: 'Small', swatch: undefined, inStock: true },
    ]);
    expect(result.specs).toEqual([
      { label: 'Light', value: 'Bright indirect' },
    ]);
  });
});

describe('toPublicCategory', () => {
  it('matches the Category shape exactly, no extra fields leaked (e.g. internal id, type)', () => {
    const category: CategoryRecord = {
      id: 'cat-1',
      slug: 'plants',
      name: 'Plants',
      description: 'Living plants',
      type: 'CATEGORY',
    };
    const result = toPublicCategory(category);
    expect(result).toEqual({
      slug: 'plants',
      name: 'Plants',
      description: 'Living plants',
    });
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('type');
  });
});

describe('toPublicReview', () => {
  it('formats the date as a bare date string, matching the existing mock data format', () => {
    const review: ReviewRecord = {
      id: 'rev-1',
      productId: 'prod-1',
      author: 'Sam',
      rating: 5,
      title: 'Great plant',
      body: 'Thriving',
      date: new Date('2026-08-01T00:00:00Z'),
      verified: true,
    };
    expect(toPublicReview(review).date).toBe('2026-08-01');
  });
});
