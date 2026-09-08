/**
 * Marketplace Phase 15 — mirrors apps/api's seller-dashboard response
 * shapes exactly (sellers/seller.types.ts's SellerProfile,
 * sellers/seller-product.types.ts's SellerProductRecord,
 * sellers/seller-order.types.ts's PublicSellerOrderGroup,
 * payouts/payout.types.ts's PublicLedgerEntry/PublicPayout). Distinct
 * from types/seller.ts's SellerStorefront, which is the public,
 * customer-facing shape (no financial or moderation fields at all) —
 * this file is the seller's own private view of their account.
 */

export type SellerStatus =
  | 'APPLIED'
  | 'UNDER_REVIEW'
  | 'REJECTED'
  | 'APPROVED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DEACTIVATED';

/** Marketplace Phase 19 — GET/POST /sellers/me/verifications. */
export interface SellerVerification {
  id: string;
  documentType: string;
  documentUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  note: string | null;
  createdAt: string;
}

export interface SellerAddress {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface SellerProfile {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  status: SellerStatus;
  address: SellerAddress | null;
  appliedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionNote: string | null;
  suspendedAt: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProductApprovalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'REJECTED'
  | 'APPROVED'
  | 'ACTIVE'
  | 'ARCHIVED';

export interface SellerProductImage {
  id: string;
  url: string;
  altText: string | null;
  position: number;
}

export interface SellerProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  description: string;
  categoryId: string;
  categoryName: string;
  careLevel: 'Easy' | 'Moderate' | 'Advanced' | undefined;
  approvalStatus: ProductApprovalStatus;
  rejectionNote: string | null;
  stockCount: number;
  inStock: boolean;
  images: SellerProductImage[];
  createdAt: string;
  updatedAt: string;
}

export interface SellerProductInput {
  name: string;
  price: number;
  compareAtPrice?: number;
  description: string;
  categoryId: string;
  careLevel?: 'Easy' | 'Moderate' | 'Advanced';
  initialStock: number;
}

export type UpdateSellerProductInput = Partial<
  Omit<SellerProductInput, 'initialStock'>
> & { stock?: number };

export type OrderGroupStatus =
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'REFUNDED';

export interface SellerOrderItem {
  id: string;
  productId: string;
  slug: string;
  name: string;
  variantId: string | null;
  variantLabel: string | null;
  price: number;
  quantity: number;
}

export interface SellerOrderShippingAddress {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface SellerOrderGroup {
  id: string;
  orderId: string;
  status: OrderGroupStatus;
  subtotal: number;
  commissionTotal: number;
  netProceeds: number;
  sellerNote: string | null;
  items: SellerOrderItem[];
  deliveryMethod: string;
  shippingAddress: SellerOrderShippingAddress;
  createdAt: string;
}

export type SellerLedgerEntryType =
  | 'SALE'
  | 'COMMISSION'
  | 'REFUND'
  | 'ADJUSTMENT'
  | 'PAYOUT';

export interface SellerLedgerEntry {
  id: string;
  type: SellerLedgerEntryType;
  amount: number;
  referenceType: string | null;
  referenceId: string | null;
  note: string | null;
  createdAt: string;
}

export type SellerPayoutStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';

export interface SellerPayout {
  id: string;
  status: SellerPayoutStatus;
  amount: number;
  failureReason: string | null;
  processedAt: string | null;
  createdAt: string;
}
