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
