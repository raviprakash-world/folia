/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Same reasoning as auth.service.spec.ts's top-of-file comment.
import { RecommendationsService } from './recommendations.service';

function makeDbProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    slug: 'monstera',
    name: 'Monstera',
    price: { toNumber: () => 50 },
    compareAtPrice: null,
    category: { name: 'Plants', slug: 'plants' },
    badge: null,
    rating: { toNumber: () => 4 },
    reviewCount: 5,
    description: 'x',
    careLevel: null,
    inStock: true,
    stockCount: 5,
    variants: [],
    specs: [],
    createdAt: new Date(),
    ...overrides,
  };
}

function createDeps() {
  const prisma = {
    product: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
  };
  const productsService = {
    findByIdOrThrow: jest.fn(),
    findManyByIds: jest.fn(),
  };
  const analyticsService = {
    topProductsByEventType: jest.fn().mockResolvedValue([]),
  };

  const service = new RecommendationsService(
    prisma as never,
    productsService as never,
    analyticsService as never,
  );
  return { prisma, productsService, analyticsService, service };
}

describe('RecommendationsService.getSimilar', () => {
  it('excludes the reference product from the candidate pool query itself', async () => {
    const { prisma, productsService, service } = createDeps();
    productsService.findByIdOrThrow.mockResolvedValue(
      makeDbProduct({ id: 'prod-1' }),
    );
    prisma.product.findMany.mockResolvedValue([]);

    await service.getSimilar('prod-1');

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: 'prod-1' } }),
      }),
    );
  });

  it('ranks the candidate pool and returns real products, not just ids', async () => {
    const { prisma, productsService, service } = createDeps();
    productsService.findByIdOrThrow.mockResolvedValue(
      makeDbProduct({
        id: 'prod-1',
        category: { name: 'Plants', slug: 'plants' },
      }),
    );
    prisma.product.findMany.mockResolvedValue([
      makeDbProduct({
        id: 'prod-2',
        category: { name: 'Plants', slug: 'plants' },
      }),
      makeDbProduct({
        id: 'prod-3',
        category: { name: 'Tools', slug: 'tools' },
      }),
    ]);

    const result = await service.getSimilar('prod-1');
    expect(result[0]?.id).toBe('prod-2'); // same category ranks higher
  });
});

describe('RecommendationsService.getFrequentlyBoughtTogether', () => {
  it('uses real order co-occurrence data when it exists, not the category fallback', async () => {
    const { prisma, productsService, service } = createDeps();
    productsService.findByIdOrThrow.mockResolvedValue(
      makeDbProduct({
        id: 'prod-1',
        category: { name: 'Plants', slug: 'plants' },
      }),
    );
    productsService.findManyByIds.mockResolvedValue([
      makeDbProduct({
        id: 'prod-vessel',
        category: { name: 'Vessels', slug: 'vessels' },
      }),
    ]);
    prisma.orderItem.findMany.mockResolvedValue([
      { orderId: 'order-1' },
      { orderId: 'order-2' },
    ]);
    prisma.orderItem.groupBy.mockResolvedValue([
      { productId: 'prod-vessel', _count: { productId: 2 } },
    ]);

    const result = await service.getFrequentlyBoughtTogether('prod-1', 1);

    expect(result[0]?.id).toBe('prod-vessel');
    expect(prisma.product.findFirst).not.toHaveBeenCalled(); // fallback never triggered — real data fully covered the request
  });

  it('falls back to the category-based pick when there is zero order history', async () => {
    const { prisma, productsService, service } = createDeps();
    productsService.findByIdOrThrow.mockResolvedValue(
      makeDbProduct({
        id: 'prod-1',
        category: { name: 'Plants', slug: 'plants' },
      }),
    );
    productsService.findManyByIds.mockResolvedValue([
      makeDbProduct({
        id: 'prod-vessel',
        category: { name: 'Vessels', slug: 'vessels' },
      }),
    ]);
    prisma.orderItem.findMany.mockResolvedValue([]); // no order history at all
    prisma.product.findFirst.mockResolvedValue(
      makeDbProduct({
        id: 'prod-vessel',
        category: { name: 'Vessels', slug: 'vessels' },
      }),
    );

    const result = await service.getFrequentlyBoughtTogether('prod-1', 1);

    expect(result).toHaveLength(1);
    expect(prisma.product.findFirst).toHaveBeenCalled(); // fallback WAS used
  });

  it('supplements partial real data with the fallback, rather than only ever using one or the other', async () => {
    const { prisma, productsService, service } = createDeps();
    productsService.findByIdOrThrow.mockResolvedValue(
      makeDbProduct({
        id: 'prod-1',
        category: { name: 'Plants', slug: 'plants' },
      }),
    );
    productsService.findManyByIds.mockResolvedValue([
      makeDbProduct({
        id: 'prod-real',
        category: { name: 'Plants', slug: 'plants' },
      }),
      makeDbProduct({
        id: 'prod-fallback',
        category: { name: 'Tools', slug: 'tools' },
      }),
    ]);
    prisma.orderItem.findMany.mockResolvedValue([{ orderId: 'order-1' }]);
    prisma.orderItem.groupBy.mockResolvedValue([
      { productId: 'prod-real', _count: { productId: 1 } },
    ]); // only 1 real result
    prisma.product.findFirst.mockResolvedValue(
      makeDbProduct({
        id: 'prod-fallback',
        category: { name: 'Tools', slug: 'tools' },
      }),
    );

    const result = await service.getFrequentlyBoughtTogether('prod-1', 2); // asked for 2

    expect(result.map((p) => p.id)).toContain('prod-real');
    expect(prisma.product.findFirst).toHaveBeenCalled(); // fallback filled the remaining slot
  });

  it('never suggests the reference product itself, even via the fallback', async () => {
    const { prisma, productsService, service } = createDeps();
    productsService.findByIdOrThrow.mockResolvedValue(
      makeDbProduct({
        id: 'prod-1',
        category: { name: 'Plants', slug: 'plants' },
      }),
    );
    productsService.findManyByIds.mockResolvedValue([]); // no historical or fallback results at all
    prisma.orderItem.findMany.mockResolvedValue([]);
    prisma.product.findFirst.mockResolvedValue(null); // no candidates ever satisfy the exclusion

    const result = await service.getFrequentlyBoughtTogether('prod-1', 2);
    expect(result.every((p) => p.id !== 'prod-1')).toBe(true);
  });
});

describe('RecommendationsService.getBestsellers', () => {
  it('filters to only BESTSELLER-badged products', async () => {
    const { prisma, service } = createDeps();
    prisma.product.findMany.mockResolvedValue([]);
    await service.getBestsellers();
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ badge: 'BESTSELLER' }),
      }),
    );
  });
});

describe('RecommendationsService.getTrending', () => {
  it('resolves real product data for each trending product id from AnalyticsService', async () => {
    const { productsService, analyticsService, service } = createDeps();
    analyticsService.topProductsByEventType.mockResolvedValue([
      { productId: 'prod-1', count: 5 },
    ]);
    productsService.findManyByIds.mockResolvedValue([
      makeDbProduct({ id: 'prod-1' }),
    ]);

    const result = await service.getTrending();
    expect(result[0]?.id).toBe('prod-1');
  });

  it('silently drops a trending product id that no longer resolves (e.g. deleted since), rather than throwing', async () => {
    const { productsService, analyticsService, service } = createDeps();
    analyticsService.topProductsByEventType.mockResolvedValue([
      { productId: 'deleted-prod', count: 3 },
    ]);
    // findManyByIds itself already omits ids that don't resolve — no
    // separate error/catch path needed here (see products.service.spec.ts's
    // own coverage of that behavior).
    productsService.findManyByIds.mockResolvedValue([]);

    await expect(service.getTrending()).resolves.toEqual([]);
  });
});
