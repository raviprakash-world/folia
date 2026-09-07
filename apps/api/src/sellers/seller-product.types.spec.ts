import {
  toAdminSellerProductRecord,
  toSellerProductRecord,
} from './seller-product.types';

function decimal(value: number) {
  return { toNumber: () => value };
}

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    slug: 'test-plant-abcd',
    name: 'Test Plant',
    price: decimal(499),
    compareAtPrice: null,
    description: 'A'.repeat(25),
    categoryId: 'cat-1',
    category: { id: 'cat-1', name: 'Plants' },
    careLevel: 'EASY',
    approvalStatus: 'DRAFT',
    rejectionNote: null,
    stockCount: 5,
    inStock: true,
    images: [
      { id: 'img-2', url: '/uploads/b.jpg', altText: null, position: 1 },
      { id: 'img-1', url: '/uploads/a.jpg', altText: null, position: 0 },
    ],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('toSellerProductRecord', () => {
  it('maps Decimal price/compareAtPrice to plain numbers', () => {
    const record = toSellerProductRecord(
      makeProduct({ compareAtPrice: decimal(599) }) as never,
    );
    expect(record.price).toBe(499);
    expect(record.compareAtPrice).toBe(599);
  });

  it('maps a null compareAtPrice to null, not 0 or undefined', () => {
    const record = toSellerProductRecord(makeProduct() as never);
    expect(record.compareAtPrice).toBeNull();
  });

  it('translates the DB careLevel enum to its public form', () => {
    const record = toSellerProductRecord(
      makeProduct({ careLevel: 'ADVANCED' }) as never,
    );
    expect(record.careLevel).toBe('Advanced');
  });

  it('sorts images by position, regardless of query return order', () => {
    const record = toSellerProductRecord(makeProduct() as never);
    expect(record.images.map((i) => i.id)).toEqual(['img-1', 'img-2']);
  });

  it('never includes a sellerId field on the seller-scoped record', () => {
    const record = toSellerProductRecord(makeProduct() as never);
    expect(record).not.toHaveProperty('sellerId');
  });
});

describe('toAdminSellerProductRecord', () => {
  it('includes everything toSellerProductRecord has, plus the owning seller', () => {
    const record = toAdminSellerProductRecord(
      makeProduct({
        seller: { id: 'seller-1', displayName: 'Terracotta & Fern' },
      }) as never,
    );
    expect(record.sellerId).toBe('seller-1');
    expect(record.sellerDisplayName).toBe('Terracotta & Fern');
    expect(record.price).toBe(499);
  });
});
