import catalog from '../../../api/prisma/demo/catalog.json';
import type { Product } from '@/types/product';

/**
 * Static fixture catalog. The single source of truth is
 * apps/api/prisma/demo/catalog.json — the same file the API's seed loads
 * into Postgres — so the storefront shows identical products, prices and
 * photos whether it's served by the real API or by this offline mock
 * (MSW in dev, and the few components that still read the array directly).
 * Everything in it is fictional demo content.
 */
const categoryNameBySlug = new Map(catalog.categories.map((c) => [c.slug, c.name]));
const sellerBySlug = new Map(catalog.sellers.map((s) => [s.slug, s]));

export const products: Product[] = catalog.products.map((p) => {
  const image = p.image as { file: string; alt: string } | null;
  const seller = p.sellerSlug ? sellerBySlug.get(p.sellerSlug) : undefined;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: p.price,
    compareAtPrice: p.compareAtPrice ?? undefined,
    category: categoryNameBySlug.get(p.categorySlug) ?? p.categorySlug,
    categorySlug: p.categorySlug,
    badge: (p.badge ?? undefined) as Product['badge'],
    rating: p.rating ?? undefined,
    reviewCount: p.reviewCount ?? undefined,
    description: p.description,
    careLevel: (p.careLevel ?? undefined) as Product['careLevel'],
    inStock: p.inStock,
    stockCount: p.stockCount,
    variants: p.variants.map((v) => ({ id: v.id, label: v.label, swatch: v.swatch ?? undefined, inStock: v.inStock })),
    specs: p.specs,
    createdAt: p.createdAt,
    images: image ? [{ url: `/demo/products/${image.file}`, altText: image.alt }] : undefined,
    seller: seller ? { id: `demo-seller-${seller.slug}`, slug: seller.slug, displayName: seller.displayName } : undefined,
  };
});
