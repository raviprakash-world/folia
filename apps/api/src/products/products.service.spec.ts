/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Same reasoning as auth.service.spec.ts's top-of-file comment — deeply
// nested untyped jest.fn() mocks, not worth full generics for a test
// file whose value is behavioral coverage of the query-building logic.
import { NotFoundException, ConflictException } from '@nestjs/common';
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

describe('ProductsService.findByIdOrThrow', () => {
  it('throws NotFoundException for an unknown or soft-deleted product id', async () => {
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new ProductsService(prisma as never);
    await expect(service.findByIdOrThrow('unknown-id')).rejects.toThrow(
      'Product not found',
    );
  });

  it('excludes soft-deleted products, same as findBySlugOrThrow', async () => {
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new ProductsService(prisma as never);
    await service.findByIdOrThrow('prod-1').catch(() => undefined);
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'prod-1', deletedAt: null } }),
    );
  });

  it('returns the product when found', async () => {
    const record = { id: 'prod-1', name: 'Monstera' };
    const prisma = {
      product: { findFirst: jest.fn().mockResolvedValue(record) },
    };
    const service = new ProductsService(prisma as never);
    await expect(service.findByIdOrThrow('prod-1')).resolves.toEqual(record);
  });
});

describe('ProductsService.adminCreate', () => {
  it('rejects a duplicate slug', async () => {
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }) },
    };
    const service = new ProductsService(prisma as never);
    await expect(
      service.adminCreate({
        slug: 'monstera',
        name: 'Monstera',
        price: 50,
        description: 'x',
        categoryId: 'cat-1',
        badge: null,
        careLevel: null,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('always initializes stockCount to 0 and inStock to false, never accepting them from admin input directly', async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn<
            Promise<unknown>,
            [{ data: { stockCount: number; inStock: boolean } }]
          >()
          .mockResolvedValue({}),
      },
    };
    const service = new ProductsService(prisma as never);

    await service.adminCreate({
      slug: 'new-product',
      name: 'New Product',
      price: 20,
      description: 'x',
      categoryId: 'cat-1',
      badge: null,
      careLevel: null,
    });

    const callArg = prisma.product.create.mock.calls[0][0];
    expect(callArg.data.stockCount).toBe(0);
    expect(callArg.data.inStock).toBe(false);
  });
});

describe('ProductsService.adminUpdate', () => {
  it('throws NotFoundException for a nonexistent product before attempting any update', async () => {
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const service = new ProductsService(prisma as never);
    await expect(
      service.adminUpdate('unknown', {
        slug: 'x',
        name: 'x',
        price: 1,
        description: 'x',
        categoryId: 'c',
        badge: null,
        careLevel: null,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('rejects renaming to a slug already used by a DIFFERENT product', async () => {
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue({ id: 'prod-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'some-other-product' }),
        update: jest.fn(),
      },
    };
    const service = new ProductsService(prisma as never);
    await expect(
      service.adminUpdate('prod-1', {
        slug: 'taken-slug',
        name: 'x',
        price: 1,
        description: 'x',
        categoryId: 'c',
        badge: null,
        careLevel: null,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('allows "renaming" a product to the slug it already owns (no-op collision)', async () => {
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue({ id: 'prod-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'prod-1' }), // same product owns this slug
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ProductsService(prisma as never);
    await expect(
      service.adminUpdate('prod-1', {
        slug: 'monstera',
        name: 'x',
        price: 1,
        description: 'x',
        categoryId: 'c',
        badge: null,
        careLevel: null,
      }),
    ).resolves.toBeDefined();
  });
});

describe('ProductsService.adminSoftDelete', () => {
  it('throws NotFoundException for a nonexistent product', async () => {
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const service = new ProductsService(prisma as never);
    await expect(service.adminSoftDelete('unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('sets deletedAt rather than actually removing the row', async () => {
    const prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue({ id: 'prod-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ProductsService(prisma as never);
    await service.adminSoftDelete('prod-1');
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});

describe('ProductsService.findManyByIds', () => {
  it('returns an empty array immediately for an empty id list, without querying at all', async () => {
    const prisma = { product: { findMany: jest.fn() } };
    const service = new ProductsService(prisma as never);
    const result = await service.findManyByIds([]);
    expect(result).toEqual([]);
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('fetches every id in a single query, not one per id', async () => {
    const prisma = { product: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new ProductsService(prisma as never);
    await service.findManyByIds(['a', 'b', 'c']);
    expect(prisma.product.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['a', 'b', 'c'] } }),
      }),
    );
  });

  it('re-orders results to match the INPUT id order, not whatever order the database happens to return', async () => {
    const prisma = {
      product: {
        // Database returns them in a DIFFERENT order than requested — a real scenario, not contrived.
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'c' }, { id: 'a' }, { id: 'b' }]),
      },
    };
    const service = new ProductsService(prisma as never);
    const result = await service.findManyByIds(['a', 'b', 'c']);
    expect(result.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('silently omits an id that no longer resolves (deleted/missing), rather than throwing', async () => {
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 'a' }]), // 'b' is missing/deleted
      },
    };
    const service = new ProductsService(prisma as never);
    const result = await service.findManyByIds(['a', 'b']);
    expect(result.map((p) => p.id)).toEqual(['a']);
  });
});
