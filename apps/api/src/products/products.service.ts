/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// See users/users.service.ts's top-of-file comment for why this exemption exists.
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ProductQueryDto, SortKey } from './dto/product-query.dto';
import type { ProductRecord, ProductBadge, CareLevel } from './product.types';

const PRODUCT_INCLUDE = {
  category: true,
  variants: true,
  specs: true,
} as const;

/**
 * Mirrors apps/web/src/mocks/handlers.ts's sortProducts() and filter logic
 * exactly in *observable behavior* (same results, same order for the same
 * inputs) — but does the actual work at the database level (Prisma
 * `where`/`orderBy`/`skip`/`take`) rather than the mock's fetch-everything-
 * then-sort-in-memory approach, since that's what a real database is for.
 *
 * "featured" sort (bestsellers first, then "catalog order") needed two
 * deliberate, non-obvious pieces to get right, not just `orderBy: badge:
 * 'desc'`:
 * 1. PostgreSQL enums sort by declaration order, not alphabetically —
 *    schema.prisma's ProductBadge enum has BESTSELLER declared LAST
 *    specifically so DESC puts it first (see that enum's own doc comment;
 *    reordering it without updating this function silently breaks this).
 * 2. Postgres's DESC default is NULLS FIRST — without the explicit
 *    `nulls: 'last'` below, every product with NO badge would sort
 *    *before* actual bestsellers, which is exactly backwards.
 * The secondary `createdAt ASC` key reproduces the mock's "catalog order"
 * tiebreaker, since prisma/seed.ts deliberately seeds products with
 * sequential createdAt values matching the original catalog's order.
 */
export function buildOrderBy(sort: SortKey | undefined) {
  switch (sort) {
    case 'price-asc':
      return [{ price: 'asc' as const }];
    case 'price-desc':
      return [{ price: 'desc' as const }];
    case 'newest':
      return [{ createdAt: 'desc' as const }];
    case 'rating':
      return [{ rating: 'desc' as const }];
    case 'featured':
    default:
      return [
        { badge: { sort: 'desc' as const, nulls: 'last' as const } },
        { createdAt: 'asc' as const },
      ];
  }
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: ProductQueryDto) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (query.category) where.category = { slug: query.category };
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      where.price = {
        ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
      };
    }
    if (query.inStockOnly) where.inStock = true;
    if (query.search)
      where.name = { contains: query.search, mode: 'insensitive' };

    const page = query.page || 1;
    const pageSize = query.pageSize || 12;

    const [total, items] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: buildOrderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: items as ProductRecord[],
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findBySlugOrThrow(slug: string): Promise<ProductRecord> {
    const product = await this.prisma.product.findFirst({
      where: { slug, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product as ProductRecord;
  }

  async findByIdOrThrow(id: string): Promise<ProductRecord> {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product as ProductRecord;
  }

  /**
   * Phase 11 hardening — replaces what RecommendationsService originally
   * did with N separate findByIdOrThrow calls (via Promise.all, so
   * concurrent, but still N real database round-trips) with a single
   * batched query. Silently omits any id that's missing or soft-deleted,
   * matching the behavior callers already relied on
   * (getTrending's .catch(() => null), now built into this method
   * instead of scattered at each call site) — this is a batch
   * convenience lookup, not a strict existence check like
   * findByIdOrThrow, so it never throws for a partially-stale id list.
   */
  async findManyByIds(ids: string[]): Promise<ProductRecord[]> {
    if (ids.length === 0) return [];
    const products = (await this.prisma.product.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: PRODUCT_INCLUDE,
    })) as ProductRecord[];
    // findMany does not preserve the input array's order — re-sort to
    // match it, since callers rank by that order (most-co-occurring or
    // most-viewed first).
    const byId = new Map(products.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is ProductRecord => !!p);
  }

  /**
   * Real admin catalog management — genuinely new capability; this
   * service was read-only from Phase 2 through Phase 8. Deliberately
   * never sets stockCount/inStock (see AdminProductInputDto's own doc
   * comment) — those stay InventoryService's exclusive write domain
   * (Phase 3's design), so a catalog edit here can never silently desync
   * real inventory numbers.
   */
  async adminCreate(input: {
    slug: string;
    name: string;
    price: number;
    compareAtPrice?: number;
    description: string;
    categoryId: string;
    brandId?: string;
    badge: ProductBadge | null;
    careLevel: CareLevel | null;
  }): Promise<ProductRecord> {
    const existing = await this.prisma.product.findUnique({
      where: { slug: input.slug },
    });
    if (existing)
      throw new ConflictException(
        `A product with slug "${input.slug}" already exists.`,
      );

    return this.prisma.product.create({
      data: { ...input, stockCount: 0, inStock: false },
      include: PRODUCT_INCLUDE,
    }) as Promise<ProductRecord>;
  }

  async adminUpdate(
    id: string,
    input: {
      slug: string;
      name: string;
      price: number;
      compareAtPrice?: number;
      description: string;
      categoryId: string;
      brandId?: string;
      badge: ProductBadge | null;
      careLevel: CareLevel | null;
    },
  ): Promise<ProductRecord> {
    await this.findByIdOrThrow(id); // 404s cleanly for an unknown/deleted id before attempting the update

    if (input.slug) {
      const slugOwner = await this.prisma.product.findUnique({
        where: { slug: input.slug },
      });
      if (slugOwner && (slugOwner as { id: string }).id !== id) {
        throw new ConflictException(
          `A different product already uses slug "${input.slug}".`,
        );
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: input,
      include: PRODUCT_INCLUDE,
    }) as Promise<ProductRecord>;
  }

  /** Soft delete — matches the schema's own documented reasoning: a deleted product shouldn't vanish from historical order line items that reference it. */
  async adminSoftDelete(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
