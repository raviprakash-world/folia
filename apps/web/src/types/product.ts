export type ProductBadge = 'New' | 'Sale' | 'Bestseller' | 'Low stock';

export interface ProductVariant {
  id: string;
  label: string;
  /** Hex swatch for color-style variants; omitted for size-style variants. */
  swatch?: string;
  inStock: boolean;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductSeller {
  id: string;
  slug: string;
  displayName: string;
}

export interface ProductImage {
  url: string;
  altText?: string;
}

export interface ShipsFrom {
  city: string;
  state: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  categorySlug: string;
  badge?: ProductBadge;
  rating?: number;
  reviewCount?: number;
  description: string;
  careLevel?: 'Easy' | 'Moderate' | 'Advanced';
  inStock: boolean;
  stockCount: number;
  variants: ProductVariant[];
  specs: ProductSpec[];
  createdAt: string;
  /** Ordered primary-first. Absent/empty means "no photo yet" — every image component falls back to the placeholder block. */
  images?: ProductImage[];
  /** Dispatch location: the seller's business address, or Folia's Bengaluru studio for Folia-owned products. Absent if unknown. */
  shipsFrom?: ShipsFrom;
  /** Marketplace Phase 16 — absent for a Folia-owned product, matching the real API's own omit-rather-than-null convention (see toPublicProduct). */
  seller?: ProductSeller;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  date: string;
  verified: boolean;
}

export type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'newest' | 'rating';

export interface ProductQuery {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: SortKey;
  page?: number;
  pageSize?: number;
  search?: string;
  /** Marketplace Phase 4 — filter to one seller's storefront. */
  sellerId?: string;
  /** UI-only (URL param): the "ships from my state" checkbox. Turned into shipFromState using the saved location; never sent as-is. */
  nearMe?: boolean;
  /** Sent to the API: only products dispatching from this state. */
  shipFromState?: string;
}

export interface ProductQueryResult {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Category {
  /** Real backend only (Phase 4) — the admin product form's category picker needs a real id, since the admin create/update endpoint takes one, not a slug. Always present from the real API; absent from the older mock catalog data, hence optional. */
  id?: string;
  slug: string;
  name: string;
  description: string;
}
