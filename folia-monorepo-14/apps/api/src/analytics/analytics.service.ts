/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment */
// See users/users.service.ts's top-of-file comment for why this exemption exists.
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AnalyticsEventType,
  DateRange,
  LogEventInput,
} from './analytics.types';

function dateFilter(range: DateRange): { gte?: Date; lte?: Date } | undefined {
  if (!range.dateFrom && !range.dateTo) return undefined;
  return {
    ...(range.dateFrom ? { gte: range.dateFrom } : {}),
    ...(range.dateTo ? { lte: range.dateTo } : {}),
  };
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deliberately swallows its own errors (logs, never throws) — logging
   * an analytics event is never allowed to fail the real user-facing
   * request that triggered it (a product view, an add-to-cart) just
   * because the event write had a problem. Callers should not `await`
   * this expecting it to represent request success.
   */
  async log(input: LogEventInput): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          type: input.type,
          userId: input.userId,
          productId: input.productId,
          orderId: input.orderId,
          // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- Prisma.InputJsonValue doesn't exist in this pre-generation sandbox's minimal stub (verified directly: node_modules/.prisma/client/default.d.ts has no InputJsonValue member at all, only a generic TransactionClient=any fallback), so ESLint's type-aware linting sees it as an unresolved "error type" here. It's a real, correctly-named Prisma export once real generation succeeds — confirmed indirectly by the exact real-environment error this cast fixes, which could only occur if InputJsonValue genuinely exists there.
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to log analytics event (type=${input.type}): ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  async countByType(
    type: AnalyticsEventType,
    range: DateRange = {},
  ): Promise<number> {
    return await this.prisma.analyticsEvent.count({
      where: {
        type,
        ...(dateFilter(range) ? { createdAt: dateFilter(range) } : {}),
      },
    });
  }

  /** Most-viewed products in the given window — the real signal "trending products" (RecommendationsService) and the admin dashboard's product-performance view both read from. */
  async topProductsByEventType(
    type: AnalyticsEventType,
    range: DateRange = {},
    limit = 10,
  ): Promise<{ productId: string; count: number }[]> {
    const grouped = await this.prisma.analyticsEvent.groupBy({
      by: ['productId'],
      where: {
        type,
        productId: { not: null },
        ...(dateFilter(range) ? { createdAt: dateFilter(range) } : {}),
      },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: limit,
    });

    return grouped
      .filter(
        (g): g is { productId: string; _count: { productId: number } } =>
          g.productId !== null,
      )
      .map((g) => ({ productId: g.productId, count: g._count.productId }));
  }

  /** Real revenue from actual completed orders' metadata (the total captured at ORDER_COMPLETED logging time), not re-derived from the Order table directly — this keeps AnalyticsService independent of OrdersService's internals, at the cost of only reflecting orders that were actually logged. */
  /**
   * Queries the real Order table directly, NOT the event log — revenue
   * is financial data with an authoritative source of truth already
   * (Order.total, from real checkout completions, Phase 5), and should
   * never depend on AnalyticsEvent logging having happened completely or
   * correctly. AnalyticsEvent is the right source for purely behavioral
   * signals with no other home (page views, search terms) — not for data
   * that already has a real system of record. An earlier version of this
   * method read from ORDER_COMPLETED event metadata instead; reconsidered
   * and fixed before any controller was built on top of it, since that
   * version's accuracy silently depended on every checkout also
   * successfully logging an event, which is not a self-evident guarantee.
   */
  async totalRevenue(range: DateRange = {}): Promise<number> {
    const orders = (await this.prisma.order.findMany({
      where: {
        status: { notIn: ['CANCELLED'] },
        ...(dateFilter(range) ? { createdAt: dateFilter(range) } : {}),
      },
      select: { total: true },
    })) as { total: { toNumber(): number } }[];

    return orders.reduce((sum, order) => sum + order.total.toNumber(), 0);
  }

  /** Real order counts by status, from the Order table directly — same "authoritative source over event log" reasoning as totalRevenue. */
  async getOrderStats(
    range: DateRange = {},
  ): Promise<{ total: number; byStatus: Record<string, number> }> {
    const grouped = await this.prisma.order.groupBy({
      by: ['status'],
      where: dateFilter(range) ? { createdAt: dateFilter(range) } : {},
      _count: { status: true },
    });

    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const g of grouped) {
      byStatus[g.status] = g._count.status;
      total += g._count.status;
    }
    return { total, byStatus };
  }

  /** Real customer counts from the User table, plus a genuine repeat-purchase rate derived from actual Order history — not approximated from events. */
  async getCustomerStats(range: DateRange = {}): Promise<{
    totalCustomers: number;
    repeatCustomers: number;
    repeatPurchaseRate: number;
  }> {
    const totalCustomers = await this.prisma.user.count({
      where: {
        deletedAt: null,
        ...(dateFilter(range) ? { createdAt: dateFilter(range) } : {}),
      },
    });

    const orderCounts = await this.prisma.order.groupBy({
      by: ['userId'],
      _count: { userId: true },
    });
    const repeatCustomers = orderCounts.filter(
      (o) => o._count.userId > 1,
    ).length;
    const customersWithOrders = orderCounts.length;

    return {
      totalCustomers,
      repeatCustomers,
      repeatPurchaseRate:
        customersWithOrders > 0 ? repeatCustomers / customersWithOrders : 0,
    };
  }
}
