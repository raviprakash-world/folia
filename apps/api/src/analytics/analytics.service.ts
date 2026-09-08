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

  /**
   * Real daily order counts + revenue from the Order table, bucketed by
   * calendar day — the admin dashboard's revenue/orders charts (Phase 4).
   * Raw SQL, not Prisma's query builder: grouping by a truncated date has
   * no query-builder equivalent (`groupBy` can only group by an actual
   * column), the same reasoning InventoryService's row-locking queries
   * already established for this codebase. Table/column names are quoted
   * verbatim to match what Prisma generated for this model (table
   * "orders", camelCase columns, no per-field @map).
   */
  async getDailyOrderMetrics(
    days = 30,
  ): Promise<{ date: string; orders: number; revenue: number }[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.$queryRaw<
      { day: Date; orderCount: bigint; revenue: string | null }[]
    >`
      SELECT
        date_trunc('day', "createdAt") AS day,
        COUNT(*)::bigint AS "orderCount",
        SUM("total")::text AS revenue
      FROM "orders"
      WHERE "createdAt" >= ${since} AND "status" != 'CANCELLED'
      GROUP BY day
      ORDER BY day ASC
    `;
    return rows.map((row) => ({
      date: row.day.toISOString().slice(0, 10),
      orders: Number(row.orderCount),
      revenue: row.revenue ? Number(row.revenue) : 0,
    }));
  }

  /**
   * Real top/bottom-selling products by actual units sold (OrderItem
   * quantities), not view-event counts — a genuinely better "best
   * sellers" signal than topProductsByEventType('PRODUCT_VIEW', ...)
   * above, which only this method actually reflects real purchases.
   * Known, stated limitation for the 'worst' direction: this can only
   * rank products that have at least one real sale in the window — a
   * product with zero sales simply has no OrderItem rows to group, so it
   * never appears here at all (there's no way to distinguish "never
   * ordered" from "not in this result page" from this query alone). A
   * true "products with zero sales" view would need a second query
   * (all products minus this result set) — out of scope for what this
   * phase actually needed.
   */
  async getTopSellingProducts(
    direction: 'best' | 'worst' = 'best',
    limit = 10,
  ): Promise<{ productId: string; name: string; unitsSold: number }[]> {
    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { status: { notIn: ['CANCELLED'] } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: direction === 'best' ? 'desc' : 'asc' } },
      take: limit,
    });

    const productIds = grouped.map((g) => g.productId);
    const products = (await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    })) as { id: string; name: string }[];
    const nameById = new Map(products.map((p) => [p.id, p.name]));

    return grouped.map((g) => ({
      productId: g.productId,
      name: nameById.get(g.productId) ?? g.productId,
      unitsSold: g._sum.quantity ?? 0,
    }));
  }

  /**
   * Marketplace Phase 14 — real seller counts by status, same
   * groupBy-from-the-authoritative-table shape as getOrderStats above.
   * The admin dashboard's own "what needs my attention" queue: APPLIED +
   * UNDER_REVIEW is the real seller-moderation backlog.
   */
  async getSellerStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
  }> {
    const grouped = await this.prisma.seller.groupBy({
      by: ['status'],
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

  /**
   * Marketplace Phase 14 — real marketplace GMV, split the same way
   * OrderSellerGroup itself already splits every order: sellerId null is
   * Folia's own direct sales, sellerId set is real marketplace seller
   * sales. Sourced from OrderSellerGroup.subtotal/commissionTotal (both
   * frozen at order-creation time, Marketplace Phases 5/8) rather than
   * Order.total, for the identical "authoritative table over a derived
   * figure" reasoning totalRevenue's own doc comment gives — and because
   * Order.total has no per-seller breakdown at all.
   */
  async getMarketplaceGmv(range: DateRange = {}): Promise<{
    sellerGmv: number;
    foliaGmv: number;
    commissionCollected: number;
  }> {
    const groups = (await this.prisma.orderSellerGroup.findMany({
      where: {
        order: {
          status: { notIn: ['CANCELLED'] },
          ...(dateFilter(range) ? { createdAt: dateFilter(range) } : {}),
        },
      },
      select: { sellerId: true, subtotal: true, commissionTotal: true },
    })) as {
      sellerId: string | null;
      subtotal: { toNumber(): number };
      commissionTotal: { toNumber(): number };
    }[];

    let sellerGmv = 0;
    let foliaGmv = 0;
    let commissionCollected = 0;
    for (const group of groups) {
      if (group.sellerId) {
        sellerGmv += group.subtotal.toNumber();
        commissionCollected += group.commissionTotal.toNumber();
      } else {
        foliaGmv += group.subtotal.toNumber();
      }
    }
    return { sellerGmv, foliaGmv, commissionCollected };
  }

  /**
   * Marketplace Phase 14 — real per-seller revenue ranking, same
   * groupBy-then-hydrate-names shape as getTopSellingProducts above.
   * Folia's own sales (sellerId null) are deliberately excluded — this
   * ranks marketplace sellers against each other, not against Folia
   * itself.
   */
  async getTopSellers(
    limit = 10,
  ): Promise<{ sellerId: string; displayName: string; revenue: number }[]> {
    const grouped = await this.prisma.orderSellerGroup.groupBy({
      by: ['sellerId'],
      where: {
        sellerId: { not: null },
        order: { status: { notIn: ['CANCELLED'] } },
      },
      _sum: { subtotal: true },
      orderBy: { _sum: { subtotal: 'desc' } },
      take: limit,
    });

    const sellerIds = grouped
      .map((g) => g.sellerId)
      .filter((id): id is string => id !== null);
    const sellers = (await this.prisma.seller.findMany({
      where: { id: { in: sellerIds } },
      select: { id: true, displayName: true },
    })) as { id: string; displayName: string }[];
    const nameById = new Map(sellers.map((s) => [s.id, s.displayName]));

    return grouped
      .filter((g) => g.sellerId !== null)
      .map((g) => ({
        sellerId: g.sellerId as string,
        displayName:
          nameById.get(g.sellerId as string) ?? (g.sellerId as string),
        revenue:
          (g._sum.subtotal as { toNumber(): number } | null)?.toNumber() ?? 0,
      }));
  }

  /**
   * Marketplace Phase 14 — the real "what needs my attention today"
   * counts, one query per real moderation/operational queue this
   * initiative actually built (Phases 2/3/9). Deliberately does NOT
   * duplicate getSellerStats' own APPLIED+UNDER_REVIEW breakdown —
   * callers needing the full per-status split should call that instead;
   * this is just the single actionable number for each queue.
   */
  async getPendingModerationCounts(): Promise<{
    sellersAwaitingReview: number;
    productsAwaitingReview: number;
    payoutsPending: number;
  }> {
    const [sellersAwaitingReview, productsAwaitingReview, payoutsPending] =
      await Promise.all([
        this.prisma.seller.count({
          where: { status: { in: ['APPLIED', 'UNDER_REVIEW'] } },
        }),
        this.prisma.product.count({
          where: { approvalStatus: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        }),
        this.prisma.sellerPayout.count({
          where: { status: { in: ['PENDING', 'PROCESSING'] } },
        }),
      ]);
    return { sellersAwaitingReview, productsAwaitingReview, payoutsPending };
  }
}
