// See users/user.types.ts's top-of-file comment for why these are hand-written.
export interface WishlistItemRecord {
  productId: string;
  addedAt: Date;
  product: {
    slug: string;
    name: string;
    categoryId: string;
    category: { slug: string };
    price: { toNumber(): number };
  };
}

/** Matches apps/web/src/types/cart.ts's WishlistItem exactly. */
export function toPublicWishlistItem(item: WishlistItemRecord) {
  return {
    productId: item.productId,
    slug: item.product.slug,
    name: item.product.name,
    categorySlug: item.product.category.slug,
    price: item.product.price.toNumber(),
    addedAt: item.addedAt.toISOString(),
  };
}
