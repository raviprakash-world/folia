import { WishlistService } from './wishlist.service';

describe('WishlistService', () => {
  it('add() upserts — adding an already-wishlisted product is a no-op success, not an error', async () => {
    const prisma = {
      wishlistItem: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const service = new WishlistService(prisma as never);

    await expect(service.add('user-1', 'prod-1')).resolves.toBeUndefined();
    expect(prisma.wishlistItem.upsert).toHaveBeenCalledWith({
      where: { userId_productId: { userId: 'user-1', productId: 'prod-1' } },
      update: {},
      create: { userId: 'user-1', productId: 'prod-1' },
    });
  });

  it('findAllForUser orders by most recently added first', async () => {
    const prisma = {
      wishlistItem: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new WishlistService(prisma as never);
    await service.findAllForUser('user-1');
    expect(prisma.wishlistItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { addedAt: 'desc' } }),
    );
  });

  it("remove scopes deletion to the given user — never touches another user's wishlist", async () => {
    const prisma = {
      wishlistItem: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const service = new WishlistService(prisma as never);
    await service.remove('user-1', 'prod-1');
    expect(prisma.wishlistItem.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', productId: 'prod-1' },
    });
  });
});
