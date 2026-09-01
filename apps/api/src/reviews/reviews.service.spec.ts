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
