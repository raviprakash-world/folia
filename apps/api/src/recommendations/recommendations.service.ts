/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
// See users/users.service.ts's top-of-file comment for why this exemption exists. Widened (Phase 13, real prisma generate) to also cover no-unsafe-return — this.prisma.orderItem.groupBy() still resolves to `any` in this sandbox's minimal pre-generation stub, cascading into its consumers; resolves once real generation succeeds.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { toPublicProduct } from '../products/product.types';
import { rankBySimilarity } from './similarity.util';
import { rankPersonalized } from './personalization.util';
import type { SimilarityProduct } from './similarity.util';
import type {
  PersonalizableProduct,
  UserSignals,
} from './personalization.util';

const CANDIDATE_POOL_LIMIT = 100; // reasonable for this catalog's scale; a much larger catalog would need a narrower pre-filter (e.g. same category) before ranking, not an in-memory scan of everything
const FBT_MIN_HISTORICAL_RESULTS = 1;

/**
 * This catalog has 3 categories (Plants/Vessels/Tools), not a richer
 * tag-based taxonomy — mirrors apps/web/src/utils/recommendations.ts's
 * own documented deviation from a generic "Fertilizer/Plant Food/
 * Decorative Pebbles" complementary chain, which doesn't map onto
 * anything actually in this catalog. Applies the same *pattern* (a plant
 * needs a vessel and care tools) to what exists here, not silently
 * substituted.
 */
const COMPLEMENTARY_CATEGORIES: Record<string, string[]> = {
  plants: ['vessels', 'tools'],
  vessels: ['plants', 'tools'],
  tools: ['plants', 'vessels'],
};

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async getSimilar(productId: string, count = 4) {
    const reference = await this.productsService.findByIdOrThrow(productId);
    const pool = await this.prisma.product.findMany({
      where: { deletedAt: null, id: { not: productId } },
      include: { category: true, variants: true, specs: true },
      take: CANDIDATE_POOL_LIMIT,
    });

    const publicPool = (pool as never[]).map((p) => toPublicProduct(p));
    const publicReference = toPublicProduct(reference);

    const asSimilarity = (
      p: ReturnType<typeof toPublicProduct>,
    ): SimilarityProduct => ({
      id: p.id,
      category: p.category,
      price: p.price,
      careLevel: p.careLevel,
      rating: p.rating,
    });

    const rankedIds = rankBySimilarity(
      publicPool.map(asSimilarity),
      asSimilarity(publicReference),
      count,
    ).map((p) => p.id);
    return rankedIds
      .map((id) => publicPool.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);
  }

  /**
   * Real co-occurrence from actual order history — for every order that
   * contained this product, which OTHER products were in that same
   * order, ranked by how often that pairing has happened. Falls back to
   * the deterministic category-based pick (see COMPLEMENTARY_CATEGORIES)
   * ONLY to fill remaining slots when real historical data is thin — a
   * brand-new product with zero order history still gets a sensible
   * suggestion instead of an empty result, but real co-occurrence always
   * takes priority when it exists.
   */
  async getFrequentlyBoughtTogether(productId: string, count = 2) {
    const reference = await this.productsService.findByIdOrThrow(productId);

    const coOccurringOrderIds = (await this.prisma.orderItem.findMany({
      where: { productId },
      select: { orderId: true },
    })) as { orderId: string }[];

    let historicalIds: string[] = [];
    if (coOccurringOrderIds.length > 0) {
      const grouped = await this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          orderId: { in: coOccurringOrderIds.map((o) => o.orderId) },
          productId: { not: productId },
        },
        _count: { productId: true },
        orderBy: { _count: { productId: 'desc' } },
        take: count,
      });
      historicalIds = grouped.map((g) => g.productId);
    }

    const results: string[] = [...historicalIds];
    if (results.length < FBT_MIN_HISTORICAL_RESULTS || results.length < count) {
      const complementarySlugs =
        COMPLEMENTARY_CATEGORIES[reference.category.slug] ?? [];
      for (const categorySlug of complementarySlugs) {
        if (results.length >= count) break;
        const candidate = (await this.prisma.product.findFirst({
          where: {
            category: { slug: categorySlug },
            deletedAt: null,
            id: { notIn: [productId, ...results] },
          },
          include: { category: true, variants: true, specs: true },
        })) as unknown;
        if (candidate) results.push((candidate as { id: string }).id);
      }
    }

    const products = await this.productsService.findManyByIds(
      results.slice(0, count),
    );
    return products.map(toPublicProduct);
  }

  async getPersonalized(context: UserSignals, count = 8) {
    const pool = (await this.prisma.product.findMany({
      where: { deletedAt: null },
      include: { category: true, variants: true, specs: true },
      take: CANDIDATE_POOL_LIMIT,
    })) as never[];
    const publicPool = pool.map((p) => toPublicProduct(p));

    const asPersonalizable = (
      p: ReturnType<typeof toPublicProduct>,
    ): PersonalizableProduct => ({
      id: p.id,
      name: p.name,
      category: p.category,
      badge: p.badge,
      rating: p.rating,
    });

    const rankedIds = rankPersonalized(
      publicPool.map(asPersonalizable),
      context,
      count,
    ).map((p) => p.id);
    return rankedIds
      .map((id) => publicPool.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);
  }

  async getBestsellers(count = 8) {
    const products = (await this.prisma.product.findMany({
      where: { deletedAt: null, badge: 'BESTSELLER' },
      include: { category: true, variants: true, specs: true },
      take: count,
    })) as never[];
    return products.map((p) => toPublicProduct(p));
  }

  /** Real signal — actual PRODUCT_VIEW events (AnalyticsService, this same phase), not a static or hardcoded list. */
  async getTrending(count = 8) {
    const top = await this.analyticsService.topProductsByEventType(
      'PRODUCT_VIEW',
      {},
      count,
    );
    const products = await this.productsService.findManyByIds(
      top.map((t) => t.productId),
    );
    return products.map(toPublicProduct);
  }
}
