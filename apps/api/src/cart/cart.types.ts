// See users/user.types.ts's top-of-file comment for why these are hand-written.
export interface PrismaDecimal {
  toNumber(): number;
}

export interface CartItemRecord {
  id: string;
  cartId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: PrismaDecimal;
  product: {
    slug: string;
    name: string;
    categoryId: string;
    category: { slug: string };
  };
  variant: { label: string } | null;
}

export interface CartRecord {
  id: string;
  userId: string | null;
  guestToken: string | null;
  items: CartItemRecord[];
}

/** Matches apps/web/src/types/cart.ts's CartItem exactly, including buildLineId's composite-key format. */
export function toPublicCartItem(item: CartItemRecord) {
  return {
    lineId: `${item.productId}::${item.variantId ?? 'none'}`,
    productId: item.productId,
    slug: item.product.slug,
    name: item.product.name,
    categorySlug: item.product.category.slug,
    price: item.unitPrice.toNumber(),
    variantId: item.variantId,
    variantLabel: item.variant?.label ?? null,
    quantity: item.quantity,
  };
}

/** { items: [...] } — the natural analog to apps/web's cartStore's own `items: CartItem[]` state, since there's no existing GET /cart response shape to match (the frontend cart is currently pure client state). */
export function toPublicCart(cart: CartRecord) {
  return { items: cart.items.map(toPublicCartItem) };
}
