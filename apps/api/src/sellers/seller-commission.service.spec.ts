/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Same reasoning as cart.service.spec.ts's top-of-file comment: jest's
// expect.any()/expect.objectContaining() are typed `any`, which trips this
// rule whenever they're assigned into a strongly-typed mock argument
// position (auditService.log here is typed via jest.fn<Promise<void>,
// [LogAuditInput]>()).
import { BadRequestException } from '@nestjs/common';
import { SellerCommissionService } from './seller-commission.service';
import type { LogAuditInput } from '../audit/audit.types';

function commissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'com-1',
    sellerId: null,
    ratePercent: 10,
    effectiveFrom: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function createDeps() {
  const prisma = {
    sellerCommission: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    seller: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
  };
  const auditService = {
    log: jest.fn<Promise<void>, [LogAuditInput]>().mockResolvedValue(undefined),
  };
  const service = new SellerCommissionService(
    prisma as never,
    auditService as never,
  );
  return { prisma, auditService, service };
}

describe('SellerCommissionService.resolveEffectiveRate', () => {
  it('uses a seller-specific override when one exists, never touching the marketplace-default query', async () => {
    const { prisma, service } = createDeps();
    prisma.sellerCommission.findFirst.mockResolvedValueOnce(
      commissionRow({ sellerId: 'seller-a', ratePercent: 15 }),
    );

    const result = await service.resolveEffectiveRate('seller-a');

    expect(result).toEqual({
      sellerId: 'seller-a',
      ratePercent: 15,
      isMarketplaceDefault: false,
    });
    expect(prisma.sellerCommission.findFirst).toHaveBeenCalledTimes(1);
  });

  it('falls back to the marketplace default when no seller-specific override exists', async () => {
    const { prisma, service } = createDeps();
    prisma.sellerCommission.findFirst
      .mockResolvedValueOnce(null) // no seller-specific override
      .mockResolvedValueOnce(
        commissionRow({ sellerId: null, ratePercent: 10 }),
      );

    const result = await service.resolveEffectiveRate('seller-b');

    expect(result).toEqual({
      sellerId: 'seller-b',
      ratePercent: 10,
      isMarketplaceDefault: true,
    });
  });

  it('respects effectiveFrom versioning — only rows already in effect are eligible, ordered most-recent-first', async () => {
    const { prisma, service } = createDeps();
    prisma.sellerCommission.findFirst.mockResolvedValueOnce(
      commissionRow({ sellerId: 'seller-a', ratePercent: 12 }),
    );

    await service.resolveEffectiveRate('seller-a');

    expect(prisma.sellerCommission.findFirst).toHaveBeenCalledWith({
      where: { sellerId: 'seller-a', effectiveFrom: { lte: expect.any(Date) } },
      orderBy: { effectiveFrom: 'desc' },
    });
  });

  it('throws rather than silently defaulting to 0% when no marketplace default has ever been configured', async () => {
    const { prisma, service } = createDeps();
    prisma.sellerCommission.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(service.resolveEffectiveRate('seller-c')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('runs inside a passed-in transaction client rather than the default prisma client, when one is given', async () => {
    const { prisma, service } = createDeps();
    const tx = {
      sellerCommission: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(
            commissionRow({ sellerId: 'seller-a', ratePercent: 8 }),
          ),
      },
    };

    const result = await service.resolveEffectiveRate('seller-a', tx as never);

    expect(result.ratePercent).toBe(8);
    expect(prisma.sellerCommission.findFirst).not.toHaveBeenCalled();
    expect(tx.sellerCommission.findFirst).toHaveBeenCalledTimes(1);
  });
});

describe('SellerCommissionService.adminSetRate', () => {
  it('creates a new versioned row for the marketplace default (sellerId: null) and audits it', async () => {
    const { prisma, auditService, service } = createDeps();
    prisma.sellerCommission.create.mockResolvedValue(
      commissionRow({ id: 'com-new', sellerId: null, ratePercent: 12 }),
    );

    const result = await service.adminSetRate('admin-1', null, 12, '1.2.3.4');

    expect(prisma.sellerCommission.create).toHaveBeenCalledWith({
      data: { sellerId: null, ratePercent: 12 },
    });
    expect(result).toEqual({ id: 'com-new', sellerId: null, ratePercent: 12 });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: 'SELLER_COMMISSION_RATE_SET',
        metadata: expect.objectContaining({
          sellerId: null,
          ratePercent: 12,
          scope: 'marketplace-default',
        }),
        ipAddress: '1.2.3.4',
      }),
    );
  });

  it('creates a seller-specific override after confirming the seller exists, and audits it under scope seller-override', async () => {
    const { prisma, auditService, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue({ id: 'seller-a' });
    prisma.sellerCommission.create.mockResolvedValue(
      commissionRow({ id: 'com-new-2', sellerId: 'seller-a', ratePercent: 20 }),
    );

    await service.adminSetRate('admin-1', 'seller-a', 20);

    expect(prisma.seller.findUnique).toHaveBeenCalledWith({
      where: { id: 'seller-a' },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ scope: 'seller-override' }),
      }),
    );
  });

  it('rejects an override for a seller that does not exist, before ever creating a rate row', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue(null);

    await expect(
      service.adminSetRate('admin-1', 'nonexistent-seller', 15),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.sellerCommission.create).not.toHaveBeenCalled();
  });

  it.each([-1, 101])(
    'rejects an out-of-range ratePercent (%d) before touching the database',
    async (ratePercent) => {
      const { prisma, service } = createDeps();

      await expect(
        service.adminSetRate('admin-1', null, ratePercent),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.sellerCommission.create).not.toHaveBeenCalled();
    },
  );
});

describe('SellerCommissionService.adminListEffectiveRates', () => {
  it("reports the marketplace default and every seller's currently effective rate", async () => {
    const { prisma, service } = createDeps();
    prisma.sellerCommission.findFirst.mockImplementation(
      ({ where }: { where: { sellerId: string | null } }) => {
        if (where.sellerId === null) {
          return Promise.resolve(
            commissionRow({ sellerId: null, ratePercent: 10 }),
          );
        }
        if (where.sellerId === 'seller-a') {
          return Promise.resolve(
            commissionRow({ sellerId: 'seller-a', ratePercent: 18 }),
          );
        }
        return Promise.resolve(null);
      },
    );
    prisma.seller.findMany.mockResolvedValue([
      { id: 'seller-a', displayName: 'Seller A' },
      { id: 'seller-b', displayName: 'Seller B' },
    ]);

    const result = await service.adminListEffectiveRates();

    expect(result.marketplaceDefault).toBe(10);
    expect(result.sellers).toEqual(
      expect.arrayContaining([
        {
          sellerId: 'seller-a',
          displayName: 'Seller A',
          ratePercent: 18,
          isMarketplaceDefault: false,
        },
        {
          sellerId: 'seller-b',
          displayName: 'Seller B',
          ratePercent: 10,
          isMarketplaceDefault: true,
        },
      ]),
    );
  });
});
