import type { Product, ProductImage, Category } from '@prisma/client';

const CARE_LEVEL_TO_PUBLIC: Record<string, 'Easy' | 'Moderate' | 'Advanced'> = {
  EASY: 'Easy',
  MODERATE: 'Moderate',
  ADVANCED: 'Advanced',
};

export function careLevelToPublic(
  careLevel: string | null,
): 'Easy' | 'Moderate' | 'Advanced' | undefined {
  return careLevel ? CARE_LEVEL_TO_PUBLIC[careLevel] : undefined;
}

type SellerProductRow = Product & {
  category: Category;
  images: ProductImage[];
};

export interface SellerProductImageRecord {
  id: string;
  url: string;
  altText: string | null;
  position: number;
}

function toImageRecord(image: ProductImage): SellerProductImageRecord {
  return {
    id: image.id,
    url: image.url,
    altText: image.altText,
    position: image.position,
  };
}

/**
 * A seller's own view of one of their products — never returned for a
 * product this seller doesn't own (every read is scoped by sellerId in
 * the query itself, see SellerProductsService). Deliberately excludes
 * `badge` (admin-only, per this DTO's own doc comment) and `sellerId`
 * (redundant — it's always "me" on this endpoint).
 */
export interface SellerProductRecord {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  description: string;
  categoryId: string;
  categoryName: string;
  careLevel: 'Easy' | 'Moderate' | 'Advanced' | undefined;
  approvalStatus: Product['approvalStatus'];
  rejectionNote: string | null;
  stockCount: number;
  inStock: boolean;
  images: SellerProductImageRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export function toSellerProductRecord(
  product: SellerProductRow,
): SellerProductRecord {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price.toNumber(),
    compareAtPrice: product.compareAtPrice
      ? product.compareAtPrice.toNumber()
      : null,
    description: product.description,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    careLevel: careLevelToPublic(product.careLevel),
    approvalStatus: product.approvalStatus,
    rejectionNote: product.rejectionNote,
    stockCount: product.stockCount,
    inStock: product.inStock,
    images: product.images
      .slice()
      .sort((a, b) => a.position - b.position)
      .map(toImageRecord),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

/** The admin moderation view — everything SellerProductRecord has, plus
 * which seller owns it (an admin queue spans every seller). */
export interface AdminSellerProductRecord extends SellerProductRecord {
  sellerId: string;
  sellerDisplayName: string;
}

export function toAdminSellerProductRecord(
  product: SellerProductRow & {
    seller: { id: string; displayName: string } | null;
  },
): AdminSellerProductRecord {
  return {
    ...toSellerProductRecord(product),
    sellerId: product.seller?.id ?? '',
    sellerDisplayName: product.seller?.displayName ?? '',
  };
}
