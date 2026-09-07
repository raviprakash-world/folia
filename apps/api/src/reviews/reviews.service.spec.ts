/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Same reasoning as cart.service.spec.ts's top-of-file comment.
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  it('filters by productId when provided', async () => {
    const prisma = { review: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new ReviewsService(prisma as never);
    await service.findMany('prod-1');
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'prod-1' } }),
    );
  });

  it('returns all reviews when no productId is given', async () => {
    const prisma = { review: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new ReviewsService(prisma as never);
    await service.findMany(undefined);
    expect(prisma.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });
});

function createDeps() {
  const tx = {
    review: {
      create: jest.fn(),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _avg: { rating: 4.5 }, _count: 2 }),
    },
    product: { update: jest.fn() },
  };
  const prisma = {
    orderItem: { findFirst: jest.fn() },
    $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
  };
  const service = new ReviewsService(prisma as never);
  return { prisma, tx, service };
}

describe('ReviewsService.createReview', () => {
  it('rejects when this user has no DELIVERED order containing this product — the real verified-purchase gate', async () => {
    const { prisma, service } = createDeps();
    prisma.orderItem.findFirst.mockResolvedValue(null);

    await expect(
      service.createReview('user-1', 'Jane D.', {
        productId: 'prod-1',
        rating: 5,
        title: 'Great',
        body: 'Loved it',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.orderItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId: 'prod-1',
          order: { userId: 'user-1', status: 'DELIVERED' },
        },
      }),
    );
  });

  it('creates a real, verified: true review once a delivered purchase is confirmed, and never accepts verified as input', async () => {
    const { prisma, tx, service } = createDeps();
    prisma.orderItem.findFirst.mockResolvedValue({ id: 'item-1' });
    tx.review.create.mockResolvedValue({
      id: 'rev-1',
      productId: 'prod-1',
      userId: 'user-1',
      author: 'Jane D.',
      rating: 5,
      title: 'Great',
      body: 'Loved it',
      date: new Date(),
      verified: true,
    });

    await service.createReview('user-1', 'Jane D.', {
      productId: 'prod-1',
      rating: 5,
      title: 'Great',
      body: 'Loved it',
    });

    expect(tx.review.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'prod-1',
        userId: 'user-1',
        author: 'Jane D.',
        rating: 5,
        verified: true,
      }),
    });
  });

  it('recomputes Product.rating/reviewCount from the real aggregate — never left as stale seed-time data', async () => {
    const { prisma, tx, service } = createDeps();
    prisma.orderItem.findFirst.mockResolvedValue({ id: 'item-1' });
    tx.review.create.mockResolvedValue({ id: 'rev-1' });
    tx.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: 2 });

    await service.createReview('user-1', 'Jane D.', {
      productId: 'prod-1',
      rating: 5,
      title: 'Great',
      body: 'Loved it',
    });

    expect(tx.review.aggregate).toHaveBeenCalledWith({
      where: { productId: 'prod-1' },
      _avg: { rating: true },
      _count: true,
    });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { rating: 4.5, reviewCount: 2 },
    });
  });

  it("converts a duplicate-review P2002 (the schema's own unique(productId, userId) constraint) into a clean 409, not a raw 500", async () => {
    const { prisma, service } = createDeps();
    prisma.orderItem.findFirst.mockResolvedValue({ id: 'item-1' });
    prisma.$transaction.mockImplementation(() =>
      Promise.reject(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['productId', 'userId'] },
        }),
      ),
    );

    await expect(
      service.createReview('user-1', 'Jane D.', {
        productId: 'prod-1',
        rating: 5,
        title: 'Great',
        body: 'Loved it',
      }),
    ).rejects.toThrow(ConflictException);
  });
});
