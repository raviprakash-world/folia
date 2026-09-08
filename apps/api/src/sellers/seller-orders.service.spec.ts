import { NotFoundException } from '@nestjs/common';
import { SellerOrdersService } from './seller-orders.service';

function groupRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    orderId: 'FOL-1',
    sellerId: 'seller-a',
    status: 'PROCESSING',
    subtotal: 100,
    commissionTotal: 10,
    sellerNote: null,
    createdAt: new Date(),
    items: [],
    order: {
      deliveryMethod: 'STANDARD',
      shippingAddressSnapshot: { id: 'addr-1', fullName: 'Jane', phone: '1' },
    },
    ...overrides,
  };
}

function createDeps() {
  const prisma = {
    orderSellerGroup: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const service = new SellerOrdersService(prisma as never);
  return { prisma, service };
}

describe('SellerOrdersService.listForSeller', () => {
  it('scopes the query to this seller only, in the WHERE clause itself', async () => {
    const { prisma, service } = createDeps();
    prisma.orderSellerGroup.findMany.mockResolvedValue([groupRow()]);
    prisma.orderSellerGroup.count.mockResolvedValue(1);

    const result = await service.listForSeller('seller-a', {
      page: 1,
      pageSize: 20,
    });

    expect(prisma.orderSellerGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sellerId: 'seller-a', status: undefined },
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('filters by status when given', async () => {
    const { prisma, service } = createDeps();
    prisma.orderSellerGroup.findMany.mockResolvedValue([]);
    prisma.orderSellerGroup.count.mockResolvedValue(0);

    await service.listForSeller('seller-a', {
      status: 'SHIPPED',
      page: 1,
      pageSize: 20,
    });

    expect(prisma.orderSellerGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sellerId: 'seller-a', status: 'SHIPPED' },
      }),
    );
  });

  it('paginates using skip/take derived from page/pageSize', async () => {
    const { prisma, service } = createDeps();
    prisma.orderSellerGroup.findMany.mockResolvedValue([]);
    prisma.orderSellerGroup.count.mockResolvedValue(0);

    await service.listForSeller('seller-a', { page: 3, pageSize: 10 });

    expect(prisma.orderSellerGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });
});

describe('SellerOrdersService.getOneForSeller', () => {
  it('returns the group when it belongs to this seller', async () => {
    const { prisma, service } = createDeps();
    prisma.orderSellerGroup.findFirst.mockResolvedValue(groupRow());

    const result = await service.getOneForSeller('seller-a', 'group-1');

    expect(prisma.orderSellerGroup.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'group-1', sellerId: 'seller-a' },
      }),
    );
    expect(result.id).toBe('group-1');
  });

  it("404s — not 403 — for a group belonging to a different seller, matching this codebase's ownership-scoping-in-the-query convention", async () => {
    const { prisma, service } = createDeps();
    prisma.orderSellerGroup.findFirst.mockResolvedValue(null);

    await expect(
      service.getOneForSeller('seller-a', 'someone-elses-group'),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('SellerOrdersService.updateSellerNote', () => {
  it('updates the note via an ownership-scoped updateMany, then re-fetches', async () => {
    const { prisma, service } = createDeps();
    prisma.orderSellerGroup.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderSellerGroup.findFirst.mockResolvedValue(
      groupRow({ sellerNote: 'Packed' }),
    );

    const result = await service.updateSellerNote(
      'seller-a',
      'group-1',
      'Packed',
    );

    expect(prisma.orderSellerGroup.updateMany).toHaveBeenCalledWith({
      where: { id: 'group-1', sellerId: 'seller-a' },
      data: { sellerNote: 'Packed' },
    });
    expect(result.sellerNote).toBe('Packed');
  });

  it('stores an empty-string note as null (clearing it), not as an empty string', async () => {
    const { prisma, service } = createDeps();
    prisma.orderSellerGroup.updateMany.mockResolvedValue({ count: 1 });
    prisma.orderSellerGroup.findFirst.mockResolvedValue(groupRow());

    await service.updateSellerNote('seller-a', 'group-1', '');

    expect(prisma.orderSellerGroup.updateMany).toHaveBeenCalledWith({
      where: { id: 'group-1', sellerId: 'seller-a' },
      data: { sellerNote: null },
    });
  });

  it('404s for a group not owned by this seller, before any note is written', async () => {
    const { prisma, service } = createDeps();
    prisma.orderSellerGroup.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateSellerNote('seller-a', 'someone-elses-group', 'note'),
    ).rejects.toThrow(NotFoundException);
  });
});
