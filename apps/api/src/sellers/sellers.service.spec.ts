import { SellersService } from './sellers.service';
import { PrismaService } from '../prisma/prisma.service';

function createDeps() {
  const prisma = {
    seller: { findUnique: jest.fn() },
  };
  const service = new SellersService(prisma as unknown as PrismaService);
  return { prisma, service };
}

describe('SellersService', () => {
  describe('findByUserId', () => {
    it('looks up a seller by userId, not by any seller id', async () => {
      const { prisma, service } = createDeps();
      const seller = { id: 'seller-1', userId: 'user-1' };
      prisma.seller.findUnique.mockResolvedValue(seller);

      const result = await service.findByUserId('user-1');

      expect(prisma.seller.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toBe(seller);
    });

    it('returns null for a user with no seller account, rather than throwing', async () => {
      const { prisma, service } = createDeps();
      prisma.seller.findUnique.mockResolvedValue(null);

      const result = await service.findByUserId('user-without-seller');

      expect(result).toBeNull();
    });
  });
});
