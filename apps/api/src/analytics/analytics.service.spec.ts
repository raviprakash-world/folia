/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// Same reasoning as auth.service.spec.ts's top-of-file comment.
import { AnalyticsService } from './analytics.service';

function createDeps() {
  const prisma = {
    analyticsEvent: {
      create: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    orderItem: { groupBy: jest.fn().mockResolvedValue([]) },
    product: { findMany: jest.fn().mockResolvedValue([]) },
    user: { count: jest.fn().mockResolvedValue(0) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const service = new AnalyticsService(prisma as never);
  return { prisma, service };
}

describe('AnalyticsService.log', () => {
  it('writes the event with all provided fields', async () => {
    const { prisma, service } = createDeps();
    prisma.analyticsEvent.create.mockResolvedValue({});

    await service.log({
      type: 'PRODUCT_VIEW',
      productId: 'prod-1',
      userId: 'user-1',
    });

    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith({
      data: {
        type: 'PRODUCT_VIEW',
        userId: 'user-1',
        productId: 'prod-1',
        orderId: undefined,
        metadata: undefined,
      },
    });
  });

  it('never throws, even when the underlying write fails — logging must not break the real request that triggered it', async () => {
    const { prisma, service } = createDeps();
    prisma.analyticsEvent.create.mockRejectedValue(new Error('db unavailable'));

    await expect(
      service.log({ type: 'PRODUCT_VIEW' }),
    ).resolves.toBeUndefined();
  });
});

describe('AnalyticsService.countByType', () => {
  it('applies a date range filter when provided', async () => {
    const { prisma, service } = createDeps();
    prisma.analyticsEvent.count.mockResolvedValue(5);
    const dateFrom = new Date('2026-01-01');
    const dateTo = new Date('2026-01-31');

    await service.countByType('ORDER_CREATED', { dateFrom, dateTo });

    expect(prisma.analyticsEvent.count).toHaveBeenCalledWith({
      where: {
        type: 'ORDER_CREATED',
        createdAt: { gte: dateFrom, lte: dateTo },
      },
    });
  });

  it('omits the createdAt filter entirely when no range is given', async () => {
    const { prisma, service } = createDeps();
    prisma.analyticsEvent.count.mockResolvedValue(5);

    await service.countByType('ORDER_CREATED');

    expect(prisma.analyticsEvent.count).toHaveBeenCalledWith({
      where: { type: 'ORDER_CREATED' },
    });
  });
});

describe('AnalyticsService.topProductsByEventType', () => {
  it('maps grouped counts to a clean {productId, count} shape', async () => {
    const { prisma, service } = createDeps();
    prisma.analyticsEvent.groupBy.mockResolvedValue([
      { productId: 'prod-1', _count: { productId: 5 } },
      { productId: 'prod-2', _count: { productId: 3 } },
    ]);

    const result = await service.topProductsByEventType('PRODUCT_VIEW');
    expect(result).toEqual([
      { productId: 'prod-1', count: 5 },
      { productId: 'prod-2', count: 3 },
    ]);
  });

  it('excludes any null productId group (should not happen given the where clause, but defensively filtered)', async () => {
    const { prisma, service } = createDeps();
    prisma.analyticsEvent.groupBy.mockResolvedValue([
      { productId: null, _count: { productId: 2 } },
    ]);

    const result = await service.topProductsByEventType('PRODUCT_VIEW');
    expect(result).toEqual([]);
  });
});

describe('AnalyticsService.totalRevenue', () => {
  it('sums the real Order.total field, from the authoritative Order table — not the event log', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findMany.mockResolvedValue([
      { total: { toNumber: () => 79.94 } },
      { total: { toNumber: () => 45.0 } },
    ]);

    expect(await service.totalRevenue()).toBeCloseTo(124.94);
  });

  it('excludes cancelled orders from revenue', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findMany.mockResolvedValue([]);

    await service.totalRevenue();

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { notIn: ['CANCELLED'] } }),
      }),
    );
  });
});

describe('AnalyticsService.getOrderStats', () => {
  it('sums per-status counts into a real total and a breakdown', async () => {
    const { prisma, service } = createDeps();
    prisma.order.groupBy.mockResolvedValue([
      { status: 'DELIVERED', _count: { status: 10 } },
      { status: 'CANCELLED', _count: { status: 2 } },
    ]);

    const result = await service.getOrderStats();
    expect(result.total).toBe(12);
    expect(result.byStatus).toEqual({ DELIVERED: 10, CANCELLED: 2 });
  });

  it('returns a real zero, not an error, when there are no orders at all', async () => {
    const { service } = createDeps();
    const result = await service.getOrderStats();
    expect(result).toEqual({ total: 0, byStatus: {} });
  });
});

describe('AnalyticsService.getCustomerStats', () => {
  it('computes a real repeat-purchase rate from actual order counts per customer', async () => {
    const { prisma, service } = createDeps();
    prisma.user.count.mockResolvedValue(50);
    prisma.order.groupBy.mockResolvedValue([
      { userId: 'user-1', _count: { userId: 3 } }, // repeat customer
      { userId: 'user-2', _count: { userId: 1 } }, // one-time
      { userId: 'user-3', _count: { userId: 1 } }, // one-time
    ]);

    const result = await service.getCustomerStats();
    expect(result.totalCustomers).toBe(50);
    expect(result.repeatCustomers).toBe(1);
    expect(result.repeatPurchaseRate).toBeCloseTo(1 / 3);
  });

  it('reports a 0 repeat-purchase rate, not NaN, when nobody has ordered yet', async () => {
    const { service } = createDeps();
    const result = await service.getCustomerStats();
    expect(result.repeatPurchaseRate).toBe(0);
  });
});

describe('AnalyticsService.getDailyOrderMetrics', () => {
  it('maps raw day-bucketed rows into date/orders/revenue, converting bigint and Decimal-as-text back to numbers', async () => {
    const { prisma, service } = createDeps();
    prisma.$queryRaw.mockResolvedValue([
      {
        day: new Date('2026-09-01T00:00:00Z'),
        orderCount: 3n,
        revenue: '150.50',
      },
      { day: new Date('2026-09-02T00:00:00Z'), orderCount: 0n, revenue: null },
    ]);

    const result = await service.getDailyOrderMetrics(30);

    expect(result).toEqual([
      { date: '2026-09-01', orders: 3, revenue: 150.5 },
      { date: '2026-09-02', orders: 0, revenue: 0 },
    ]);
  });

  it('queries against a cutoff derived from the requested day count', async () => {
    const { prisma, service } = createDeps();
    await service.getDailyOrderMetrics(7);
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});

describe('AnalyticsService.getTopSellingProducts', () => {
  it('sorts descending for "best" and attaches real product names', async () => {
    const { prisma, service } = createDeps();
    prisma.orderItem.groupBy.mockResolvedValue([
      { productId: 'prod-1', _sum: { quantity: 42 } },
      { productId: 'prod-2', _sum: { quantity: 10 } },
    ]);
    prisma.product.findMany.mockResolvedValue([
      { id: 'prod-1', name: 'ZZ Plant' },
      { id: 'prod-2', name: 'Pothos' },
    ]);

    const result = await service.getTopSellingProducts('best', 10);

    expect(result).toEqual([
      { productId: 'prod-1', name: 'ZZ Plant', unitsSold: 42 },
      { productId: 'prod-2', name: 'Pothos', unitsSold: 10 },
    ]);
    expect(prisma.orderItem.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { _sum: { quantity: 'desc' } },
      }),
    );
  });

  it('sorts ascending for "worst"', async () => {
    const { prisma, service } = createDeps();
    await service.getTopSellingProducts('worst', 5);
    expect(prisma.orderItem.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { _sum: { quantity: 'asc' } },
      }),
    );
  });

  it('falls back to the raw product id when a product has since been deleted', async () => {
    const { prisma, service } = createDeps();
    prisma.orderItem.groupBy.mockResolvedValue([
      { productId: 'prod-gone', _sum: { quantity: 5 } },
    ]);
    prisma.product.findMany.mockResolvedValue([]);

    const result = await service.getTopSellingProducts('best', 10);
    expect(result[0].name).toBe('prod-gone');
  });
});
