import { apiClient } from './apiClient';
import type { CartItem } from '@/types/cart';

/** Matches the real backend's cart response shape (Phase 4/5) — verified directly via curl against a live backend before writing this, not assumed. Deliberately omits maxQuantity: the backend doesn't return a per-item stock ceiling on the cart itself (that's InventoryService's separate /inventory/availability concern), and the backend is now what actually enforces real limits on add/update — this frontend value becomes a soft UI hint, not the real enforcement. */
interface RealCartItem {
  lineId: string;
  productId: string;
  slug: string;
  name: string;
  categorySlug: string;
  price: number;
  variantId: string | null;
  variantLabel: string | null;
  quantity: number;
}

interface RealCartResponse {
  items: RealCartItem[];
}

const SOFT_MAX_QUANTITY_HINT = 99;

function toFrontendCartItem(item: RealCartItem): CartItem {
  return { ...item, maxQuantity: SOFT_MAX_QUANTITY_HINT };
}

export async function fetchRealCart(): Promise<CartItem[]> {
  const { data } = await apiClient.get<RealCartResponse>('/cart');
  return data.items.map(toFrontendCartItem);
}

export async function addRealCartItem(productId: string, variantId: string | null, quantity: number): Promise<CartItem[]> {
  // variantId omitted entirely when null, not sent as null — the real
  // backend's AddCartItemDto uses @IsOptional() @IsString(), which
  // accepts the field being absent (undefined), not an explicit null.
  // Confirmed directly against the real DTO before this shipped, not
  // assumed — sending null here would have been rejected with a real
  // 400 validation error for every variant-less product.
  const body = variantId ? { productId, variantId, quantity } : { productId, quantity };
  const { data } = await apiClient.post<RealCartResponse>('/cart/items', body);
  return data.items.map(toFrontendCartItem);
}
