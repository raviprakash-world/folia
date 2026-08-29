/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Same reasoning as auth.service.spec.ts's top-of-file comment — deeply
// nested untyped jest.fn() mocks, not worth full generics for a test
// file whose value is behavioral coverage of the query-building logic.
import { ProductsService, buildOrderBy } from './products.service';

describe('buildOrderBy', () => {
  it('featured sort (default) puts bestsellers first via declaration-order DESC with nulls last', () => {
    // This exact shape is load-bearing — see products.service.ts's own
    // comment and schema.prisma's ProductBadge enum comment for why.
    expect(buildOrderBy('featured')).toEqual([
      { badge: { sort: 'desc', nulls: 'last' } },
      { createdAt: 'asc' },
    ]);
  });

  it('defaults to featured ordering when no sort is specified', () => {
    expect(buildOrderBy(undefined)).toEqual(buildOrderBy('featured'));
  });

  it('price-asc sorts by price ascending only', () => {
    expect(buildOrderBy('price-asc')).toEqual([{ price: 'asc' }]);
  });

  it('price-desc sorts by price descending only', () => {
    expect(buildOrderBy('price-desc')).toEqual([{ price: 'desc' }]);
  });

  it('newest sorts by createdAt descending', () => {
    expect(buildOrderBy('newest')).toEqual([{ createdAt: 'desc' }]);
  });

  it('rating sorts by rating descending', () => {
    expect(buildOrderBy('rating')).toEqual([{ rating: 'desc' }]);
  });
});

describe('ProductsService.findMany', () => {
  function createMockPrisma() {
    return {
      $transaction: jest.fn(),
      product: { count: jest.fn(), findMany: jest.fn() },
    };
  }

  it('filters by category slug via the related Category record, not a denormalized string', () => {
    const prisma = createMockPrisma();
    prisma.$transaction.mockResolvedValue([0, []]);
    const service = new ProductsService(prisma as never);

    void service.findMany({
      category: 'plants',
      page: 1,
      pageSize: 12,
    });

    expect(prisma.product.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: { slug: 'plants' } }),
      }),
    );
  });

  it('applies both minPrice and maxPrice as gte/lte on the same price filter', async () => {
    const prisma = createMockPrisma();
    prisma.$transaction.mockResolvedValue([0, []]);
    const service = new ProductsService(prisma as never);

    await service.findMany({
      minPrice: 20,
      maxPrice: 80,
      page: 1,
      pageSize: 12,
    });

    expect(prisma.product.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ price: { gte: 20, lte: 80 } }),
      }),
    );
  });

  it('excludes soft-deleted products always, regardless of other filters', async () => {
    const prisma = createMockPrisma();
    prisma.$transaction.mockResolvedValue([0, []]);
    const service = new ProductsService(prisma as never);

    await service.findMany({ page: 1, pageSize: 12 });

    expect(prisma.product.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it('computes totalPages correctly, always at least 1 even with zero results', async () => {
    const prisma = createMockPrisma();
    prisma.$transaction.mockResolvedValue([0, []]);
    const service = new ProductsService(prisma as never);

    const result = await service.findMany({
      page: 1,
      pageSize: 12,
    });
    expect(result.totalPages).toBe(1);
  });

  it('computes totalPages correctly for a real result count', async () => {
    const prisma = createMockPrisma();
    prisma.$transaction.mockResolvedValue([25, []]);
    const service = new ProductsService(prisma as never);

    const result = await service.findMany({
      page: 1,
      pageSize: 12,
    });
    expect(result.totalPages).toBe(3); // ceil(25/12)
  });

  it('applies correct skip/take for page 2', async () => {
    const prisma = createMockPrisma();
    prisma.$transaction.mockResolvedValue([0, []]);
    const service = new ProductsService(prisma as never);

    await service.findMany({ page: 2, pageSize: 12 });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 12, take: 12 }),
    );
  });
});
