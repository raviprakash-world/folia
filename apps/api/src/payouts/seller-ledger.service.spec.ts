import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SellerLedgerService } from './seller-ledger.service';
import type { LogAuditInput } from '../audit/audit.types';

function createDeps() {
  const prisma = {
    sellerLedgerEntry: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    seller: { findUnique: jest.fn() },
  };
  const auditService = {
    log: jest.fn<Promise<void>, [LogAuditInput]>().mockResolvedValue(undefined),
  };
  const service = new SellerLedgerService(
    prisma as never,
    auditService as never,
  );
  return { prisma, auditService, service };
}

describe('SellerLedgerService.recordOrderProceeds', () => {
  it('writes SALE (positive, gross subtotal) and COMMISSION (negative, the commission amount) inside the passed-in transaction', async () => {
    const { service } = createDeps();
    const tx = { sellerLedgerEntry: { createMany: jest.fn() } };

    await service.recordOrderProceeds(
      tx as never,
      'seller-a',
      'group-1',
      100,
      10,
    );

    expect(tx.sellerLedgerEntry.createMany).toHaveBeenCalledWith({
      data: [
        {
          sellerId: 'seller-a',
          type: 'SALE',
          amount: 100,
          referenceType: 'ORDER_SELLER_GROUP',
          referenceId: 'group-1',
        },
        {
          sellerId: 'seller-a',
          type: 'COMMISSION',
          amount: -10,
          referenceType: 'ORDER_SELLER_GROUP',
          referenceId: 'group-1',
        },
      ],
    });
  });
});

describe('SellerLedgerService.recordPayout', () => {
  it('writes a PAYOUT entry with a negative amount equal to -amount, referencing the payout', async () => {
    const { prisma, service } = createDeps();
    prisma.sellerLedgerEntry.create.mockResolvedValue({ id: 'entry-1' });

    await service.recordPayout('seller-a', 'payout-1', 60);

    expect(prisma.sellerLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        sellerId: 'seller-a',
        type: 'PAYOUT',
        amount: -60,
        referenceType: 'SELLER_PAYOUT',
        referenceId: 'payout-1',
      },
    });
  });
});

describe('SellerLedgerService.getBalance', () => {
  it('is the plain SUM(amount) over every entry — no filtering', async () => {
    const { prisma, service } = createDeps();
    prisma.sellerLedgerEntry.aggregate.mockResolvedValue({
      _sum: { amount: 42.5 },
    });

    const balance = await service.getBalance('seller-a');

    expect(balance).toBe(42.5);
    expect(prisma.sellerLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: { sellerId: 'seller-a' },
      _sum: { amount: true },
    });
  });

  it('returns 0, not null/undefined, when a seller has no ledger entries at all', async () => {
    const { prisma, service } = createDeps();
    prisma.sellerLedgerEntry.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });

    expect(await service.getBalance('seller-new')).toBe(0);
  });
});

describe('SellerLedgerService.adminAdjust', () => {
  it('writes a real ADJUSTMENT entry (positive) and audits it', async () => {
    const { prisma, auditService, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue({ id: 'seller-a' });
    prisma.sellerLedgerEntry.create.mockResolvedValue({
      id: 'entry-adj',
      sellerId: 'seller-a',
      type: 'ADJUSTMENT',
      amount: 25,
      note: 'goodwill credit',
    });

    const entry = await service.adminAdjust(
      'admin-1',
      'seller-a',
      25,
      'goodwill credit',
      '1.2.3.4',
    );

    expect(prisma.sellerLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        sellerId: 'seller-a',
        type: 'ADJUSTMENT',
        amount: 25,
        note: 'goodwill credit',
      },
    });
    expect(entry.id).toBe('entry-adj');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        action: 'SELLER_LEDGER_ADJUSTMENT',
        metadata: { sellerId: 'seller-a', amount: 25, note: 'goodwill credit' },
      }),
    );
  });

  it('rejects a 0 adjustment before touching the database — it has no effect', async () => {
    const { prisma, service } = createDeps();

    await expect(
      service.adminAdjust('admin-1', 'seller-a', 0, 'noop'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.sellerLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects an adjustment for a seller that does not exist', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue(null);

    await expect(
      service.adminAdjust('admin-1', 'nonexistent', 10, 'note'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.sellerLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('accepts a negative amount — a debit is a real, valid correction', async () => {
    const { prisma, service } = createDeps();
    prisma.seller.findUnique.mockResolvedValue({ id: 'seller-a' });
    prisma.sellerLedgerEntry.create.mockResolvedValue({
      id: 'entry-debit',
      amount: -15,
    });

    await service.adminAdjust('admin-1', 'seller-a', -15, 'correction');

    expect(prisma.sellerLedgerEntry.create).toHaveBeenCalledWith({
      data: {
        sellerId: 'seller-a',
        type: 'ADJUSTMENT',
        amount: -15,
        note: 'correction',
      },
    });
  });
});

describe('SellerLedgerService.listForSeller', () => {
  it('paginates and returns the total count alongside the page of items', async () => {
    const { prisma, service } = createDeps();
    prisma.sellerLedgerEntry.findMany.mockResolvedValue([{ id: 'e1' }]);
    prisma.sellerLedgerEntry.count.mockResolvedValue(37);

    const result = await service.listForSeller('seller-a', {
      page: 2,
      pageSize: 10,
    });

    expect(prisma.sellerLedgerEntry.findMany).toHaveBeenCalledWith({
      where: { sellerId: 'seller-a' },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
    expect(result).toEqual({ items: [{ id: 'e1' }], total: 37 });
  });
});
