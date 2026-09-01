/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
// See users/users.service.ts's top-of-file comment for why this exemption exists. Widened (Phase 13, real prisma generate) to also cover no-unsafe-assignment/no-unsafe-return — this.prisma.searchQuery.groupBy() still resolves to `any` in this sandbox's minimal pre-generation stub, cascading into its consumers; resolves once real generation succeeds.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { CategoriesService } from '../categories/categories.service';
import { toPublicProduct, toPublicCategory } from '../products/product.types';
import { rankProducts } from './product-ranking.util';
import { findDidYouMean, sortByRelevance } from './text-match.util';
import type { RankableProduct } from './product-ranking.util';

const PRODUCT_RESULT_LIMIT = 6;
const CATEGORY_RESULT_LIMIT = 4;
const TRENDING_LIMIT = 8;
const TRENDING_LOOKBACK_DAYS = 7;

export interface SearchContext {
  wishlistIds?: string[];
  purchasedProductIds?: string[];
  recentlyViewedIds?: string[];
}

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async search(query: string, context: SearchContext = {}) {
    const trimmed = query.trim();
    if (!trimmed) {
      return { products: [], categories: [], didYouMean: null };
    }

    // Fire-and-forget logging — a search that fails to log shouldn't fail
    // the actual search request the person is waiting on.
    void this.logQuery(trimmed);

    const trendingProductIds = await this.getTrendingProductIds();

    const [productPage, categories, collections] = await Promise.all([
      this.productsService.findMany({ search: trimmed, page: 1, pageSize: 20 }),
      this.categoriesService.findAllByType('CATEGORY'),
      this.categoriesService.findAllByType('COLLECTION'),
    ]);

    const publicProducts = productPage.items.map(toPublicProduct);
    const rankable: RankableProduct[] = publicProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      badge: p.badge,
      rating: p.rating,
    }));
    const rankedIds = rankProducts(rankable, trimmed, {
      ...context,
      trendingProductIds,
    }).map((p) => p.id);
    const rankedProducts = rankedIds
      .map((id) => publicProducts.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .slice(0, PRODUCT_RESULT_LIMIT);

    const allCategoryLike = [...categories, ...collections].map(
      toPublicCategory,
    );
    const matchedCategories = sortByRelevance(
      allCategoryLike,
      trimmed,
      (c) => c.name,
    ).slice(0, CATEGORY_RESULT_LIMIT);

    const totalResults = rankedProducts.length + matchedCategories.length;
    const didYouMean =
      totalResults === 0
        ? await this.findSuggestion(
            trimmed,
            allCategoryLike.map((c) => c.name),
          )
        : null;

    return {
      products: rankedProducts,
      categories: matchedCategories,
      didYouMean,
    };
  }

  /**
   * Only called on the zero-results path, so the extra query doesn't cost
   * anything on a normal search. Deliberately does NOT reuse the
   * already-filtered search results as candidates — those are exactly
   * what's empty when the query is a typo, since the SQL `contains`
   * filter (ProductsService.findMany) already excluded everything. A
   * separate, broader (though still bounded) product-name fetch is
   * needed, matching apps/web/src/hooks/useSearchResults.ts's own
   * didYouMean logic, which explicitly uses the FULL unfiltered catalog
   * (`allProducts`) as its candidate list, not the filtered results —
   * caught and fixed here after a test correctly demonstrated the
   * original version could never actually suggest a correction for a
   * genuine typo.
   */
  private async findSuggestion(
    query: string,
    categoryNames: string[],
  ): Promise<string | null> {
    const products = (await this.prisma.product.findMany({
      where: { deletedAt: null },
      select: { name: true },
      take: 200,
    })) as { name: string }[];
    return findDidYouMean(query, [
      ...products.map((p) => p.name),
      ...categoryNames,
    ]);
  }

  /** Real aggregation over actually-logged queries — GROUP BY term, ORDER BY count — replacing the frontend's static pool (apps/web/src/data/trendingSearches.ts) with genuine usage data. */
  async getTrending(): Promise<string[]> {
    const since = new Date(
      Date.now() - TRENDING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );
    const grouped = await this.prisma.searchQuery.groupBy({
      by: ['term'],
      where: { createdAt: { gte: since } },
      _count: { term: true },
      orderBy: { _count: { term: 'desc' } },
      take: TRENDING_LIMIT,
    });
    return grouped.map((g) => g.term);
  }

  private async logQuery(term: string): Promise<void> {
    await this.prisma.searchQuery.create({
      data: { term: term.toLowerCase() },
    });
  }

  /** Trending PRODUCT ids (not just terms) — used to give trending items a small ranking boost, matching apps/web's own trendingProductIds signal. Best-effort: a trending search term that happens to match a product name by name/prefix counts as that product trending. */
  private async getTrendingProductIds(): Promise<string[]> {
    const trendingTerms = await this.getTrending();
    if (trendingTerms.length === 0) return [];
    const matches = (await this.prisma.product.findMany({
      where: {
        OR: trendingTerms.map((term) => ({
          name: { contains: term, mode: 'insensitive' },
        })),
      },
      select: { id: true },
      take: 20,
    })) as { id: string }[];
    return matches.map((m) => m.id);
  }
}
