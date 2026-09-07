import type {
  AddressSnapshot,
  DeliveryMethodType,
} from '../orders/order.types';

/** The one order-line shape a seller ever sees — no other seller's or Folia's items in the same order are ever included, since this is built from OrderSellerGroup.items (the FK-scoped relation), never Order.items directly. */
export interface PublicSellerOrderItem {
  id: string;
  productId: string;
  slug: string;
  name: string;
  variantId: string | null;
  variantLabel: string | null;
  price: number;
  quantity: number;
}

export interface PublicSellerOrderGroup {
  id: string;
  orderId: string;
  status: string;
  subtotal: number;
  commissionTotal: number;
  /** subtotal - commissionTotal — what this seller actually nets from this order, matching SellerLedgerService's own SALE + COMMISSION amounts exactly. */
  netProceeds: number;
  sellerNote: string | null;
  items: PublicSellerOrderItem[];
  deliveryMethod: DeliveryMethodType;
  /**
   * Never the customer's email — a seller needs an address and phone
   * number to ship a package, not a channel to contact the customer
   * off-platform. Same data-minimization discipline as
   * PublicSellerStorefront (Marketplace Phase 4) excluding contact
   * details in the other direction.
   */
  shippingAddress: Omit<AddressSnapshot, 'email'>;
  createdAt: Date;
}

interface RawSellerOrderGroup {
  id: string;
  orderId: string;
  status: string;
  subtotal: unknown;
  commissionTotal: unknown;
  sellerNote: string | null;
  createdAt: Date;
  items: {
    id: string;
    productId: string;
    slug: string;
    name: string;
    variantId: string | null;
    variantLabel: string | null;
    price: unknown;
    quantity: number;
  }[];
  order: {
    deliveryMethod: DeliveryMethodType;
    shippingAddressSnapshot: unknown;
  };
}

export function toPublicSellerOrderGroup(
  group: RawSellerOrderGroup,
): PublicSellerOrderGroup {
  const subtotal = Number(group.subtotal);
  const commissionTotal = Number(group.commissionTotal);
  const { email: _email, ...shippingAddress } = group.order
    .shippingAddressSnapshot as AddressSnapshot;

  return {
    id: group.id,
    orderId: group.orderId,
    status: group.status,
    subtotal,
    commissionTotal,
    netProceeds: subtotal - commissionTotal,
    sellerNote: group.sellerNote,
    items: group.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      variantId: item.variantId,
      variantLabel: item.variantLabel,
      price: Number(item.price),
      quantity: item.quantity,
    })),
    deliveryMethod: group.order.deliveryMethod,
    shippingAddress,
    createdAt: group.createdAt,
  };
}
