/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// See users/users.service.ts's top-of-file comment for why this exemption exists.
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ProductQueryDto, SortKey } from './dto/product-query.dto';
import type { ProductRecord } from './product.types';

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
}
