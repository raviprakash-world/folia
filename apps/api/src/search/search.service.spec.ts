// Same reasoning as auth.service.spec.ts's top-of-file comment.
import { SearchService } from './search.service';

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1',
    slug: 'monstera',
    name: 'Monstera Deliciosa',
    price: { toNumber: () => 68 },
    compareAtPrice: null,
    category: { name: 'Plants', slug: 'plants' },
    badge: null,
    rating: { toNumber: () => 4.5 },
    reviewCount: 10,
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
    searchQuery: {
      create: jest.fn().mockResolvedValue({}),
      groupBy: jest
        .fn<
          Promise<unknown[]>,
          [{ where: { createdAt: { gte: Date } }; orderBy: unknown }]
        >()
        .mockResolvedValue([]),
    },
    product: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const productsService = {
    findMany: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    }),
  };
  const categoriesService = { findAllByType: jest.fn().mockResolvedValue([]) };

  const service = new SearchService(
    prisma as never,
    productsService as never,
    categoriesService as never,
  );
  return { prisma, productsService, categoriesService, service };
}

describe('SearchService.search', () => {
  it('returns empty results immediately for a blank query, without logging or querying anything', async () => {
    const { prisma, productsService, service } = createDeps();
    const result = await service.search('   ');

    expect(result).toEqual({ products: [], categories: [], didYouMean: null });
    expect(prisma.searchQuery.create).not.toHaveBeenCalled();
    expect(productsService.findMany).not.toHaveBeenCalled();
  });

  it('logs the (trimmed, lowercased) query for a real search', async () => {
    const { prisma, service } = createDeps();
    await service.search('  Monstera  ');
    expect(prisma.searchQuery.create).toHaveBeenCalledWith({
      data: { term: 'monstera' },
    });
  });

  it('ranks matching products by relevance, highest first', async () => {
    const { productsService, service } = createDeps();
    productsService.findMany.mockResolvedValue({
      items: [
        makeProduct({
          id: 'a',
          name: 'Ceramic Pot',
          category: { name: 'Vessels', slug: 'vessels' },
        }),
        makeProduct({
          id: 'b',
          name: 'Monstera',
          category: { name: 'Plants', slug: 'plants' },
        }),
      ],
      total: 2,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const result = await service.search('monstera');
    expect(result.products[0]?.id).toBe('b');
  });

  it('matches categories and collections by relevance too', async () => {
    const { categoriesService, service } = createDeps();
    categoriesService.findAllByType.mockImplementation((type: string) =>
      Promise.resolve(
        type === 'CATEGORY'
          ? [
              {
                slug: 'plants',
                name: 'Plants',
                description: 'x',
                type: 'CATEGORY',
              },
            ]
          : [],
      ),
    );

    const result = await service.search('plants');
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0]?.name).toBe('Plants');
  });

  it('offers a did-you-mean suggestion only when there are zero results', async () => {
    const { productsService, service } = createDeps();
    productsService.findMany.mockResolvedValue({
      items: [makeProduct({ id: 'a', name: 'Monstera' })],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    // "monstera" itself matches — no suggestion needed even if close terms exist
    const resultWithMatch = await service.search('monstera');
    expect(resultWithMatch.didYouMean).toBeNull();
  });

  it('suggests a correction from the FULL catalog, not just the (empty, since it is a typo) filtered search results', async () => {
    const { prisma, productsService, service } = createDeps();
    // Real behavior being simulated: ProductsService.findMany's SQL
    // `contains` filter finds nothing for a typo — items comes back
    // empty. The fix being tested is that did-you-mean still works by
    // querying a separate, broader candidate list instead of reusing
    // these (correctly empty) filtered results — a bug caught by an
    // earlier version of this exact test, which had mistakenly mocked
    // findMany to return a matching product even for the typo'd query,
    // masking the real gap.
    productsService.findMany.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    prisma.product.findMany = jest.fn().mockResolvedValue([{ name: 'Fern' }]);

    const result = await service.search('fernn'); // 1-edit-distance typo, already verified correct in text-match.util.spec.ts
    expect(result.products).toHaveLength(0);
    expect(result.didYouMean).toBe('Fern');
  });
});

describe('SearchService.getTrending', () => {
  it('queries only the last 7 days and orders by count descending', async () => {
    const { prisma, service } = createDeps();
    await service.getTrending();

    const callArg = prisma.searchQuery.groupBy.mock.calls[0][0];
    const daysSince =
      (Date.now() - callArg.where.createdAt.gte.getTime()) /
      (1000 * 60 * 60 * 24);
    expect(daysSince).toBeCloseTo(7, 0);
    expect(callArg.orderBy).toEqual({ _count: { term: 'desc' } });
  });

  it('returns just the term strings, not the full grouped aggregate objects', async () => {
    const { prisma, service } = createDeps();
    prisma.searchQuery.groupBy.mockResolvedValue([
      { term: 'monstera', _count: { term: 5 } },
      { term: 'succulent', _count: { term: 2 } },
    ]);

    const result = await service.getTrending();
    expect(result).toEqual(['monstera', 'succulent']);
  });
});
