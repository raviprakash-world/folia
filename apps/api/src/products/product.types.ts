// See users/user.types.ts's top-of-file comment for why these are
// hand-written instead of imported from '@prisma/client'.

/** Duck-typed to match Prisma's real Decimal class API (.toNumber()) — writing it this way now means zero changes once the generated client exists. */
export interface PrismaDecimal {
  toNumber(): number;
}

export type ProductBadge = 'NEW' | 'SALE' | 'BESTSELLER' | 'LOW_STOCK';
export type CareLevel = 'EASY' | 'MODERATE' | 'ADVANCED';
export type CategoryType = 'CATEGORY' | 'COLLECTION';

export interface CategoryRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: CategoryType;
}

export interface ProductVariantRecord {
  id: string;
  label: string;
  swatch: string | null;
  inStock: boolean;
}

export interface ProductSpecRecord {
  id: string;
  label: string;
  value: string;
}

export interface ReviewRecord {
  id: string;
  productId: string;
  author: string;
  rating: number;
  title: string;
  body: string;
  date: Date;
  verified: boolean;
}

export interface ProductRecord {
  id: string;
  slug: string;
  name: string;
  price: PrismaDecimal;
  compareAtPrice: PrismaDecimal | null;
  description: string;
  categoryId: string;
  category: CategoryRecord;
  badge: ProductBadge | null;
  careLevel: CareLevel | null;
  rating: PrismaDecimal | null;
  reviewCount: number;
  inStock: boolean;
  stockCount: number;
  variants: ProductVariantRecord[];
  specs: ProductSpecRecord[];
  createdAt: Date;
  deletedAt: Date | null;
}

const badgeToPublic: Record<
  ProductBadge,
  'New' | 'Sale' | 'Bestseller' | 'Low stock'
> = {
  NEW: 'New',
  SALE: 'Sale',
  BESTSELLER: 'Bestseller',
  LOW_STOCK: 'Low stock',
};

const careLevelToPublic: Record<CareLevel, 'Easy' | 'Moderate' | 'Advanced'> = {
  EASY: 'Easy',
  MODERATE: 'Moderate',
  ADVANCED: 'Advanced',
};

/** Matches apps/web/src/types/product.ts's Product shape exactly. */
export function toPublicProduct(product: ProductRecord) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price.toNumber(),
    compareAtPrice: product.compareAtPrice?.toNumber(),
    category: product.category.name,
    categorySlug: product.category.slug,
    badge: product.badge ? badgeToPublic[product.badge] : undefined,
    rating: product.rating?.toNumber(),
    reviewCount: product.reviewCount || undefined,
    description: product.description,
    careLevel: product.careLevel
      ? careLevelToPublic[product.careLevel]
      : undefined,
    inStock: product.inStock,
    stockCount: product.stockCount,
    variants: product.variants.map((v) => ({
      id: v.id,
      label: v.label,
      swatch: v.swatch ?? undefined,
      inStock: v.inStock,
    })),
    specs: product.specs.map((s) => ({ label: s.label, value: s.value })),
    createdAt: product.createdAt.toISOString().slice(0, 10),
  };
}

/** Matches apps/web/src/types/product.ts's Category shape exactly (used for both categories and collections). */
export function toPublicCategory(category: CategoryRecord) {
  return {
    slug: category.slug,
    name: category.name,
    description: category.description,
  };
}

/** Matches apps/web/src/types/product.ts's Review shape exactly. */
export function toPublicReview(review: ReviewRecord) {
  return {
    id: review.id,
    productId: review.productId,
    author: review.author,
    rating: review.rating as 1 | 2 | 3 | 4 | 5,
    title: review.title,
    body: review.body,
    date: review.date.toISOString().slice(0, 10),
    verified: review.verified,
  };
}
