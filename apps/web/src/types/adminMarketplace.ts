/**
 * Marketplace Phase 17 — the admin-facing marketplace management surface.
 * Reuses types/sellerDashboard.ts's SellerProfile/SellerProductImage/
 * ProductApprovalStatus/SellerLedgerEntry/SellerPayout wherever the admin
 * response shape is identical to the seller's own (both are built from
 * the same backend toSellerProfile/toSellerProductRecord/
 * toPublicLedgerEntry/toPublicPayout mappings) — only genuinely
 * admin-only fields/shapes are added here.
 */
import type { SellerProfile, SellerProductImage, ProductApprovalStatus } from './sellerDashboard';

export interface SellerVerificationRecord {
  id: string;
  documentType: string;
  documentUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy: string | null;
  reviewedAt: string | null;
  note: string | null;
  createdAt: string;
}

/** GET /admin/sellers, GET /admin/sellers/:id — everything SellerProfile has, plus moderation-only fields. */
export interface AdminSellerRecord extends SellerProfile {
  userId: string;
  statusNote: string | null;
  verifications: SellerVerificationRecord[];
}

/** GET /admin/seller-products, GET /admin/seller-products/:id. */
export interface AdminSellerProductRecord {
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
  sellerId: string;
  sellerDisplayName: string;
}

/** GET /admin/commissions. */
export interface AdminCommissionRate {
  sellerId: string;
  displayName: string;
  ratePercent: number;
  isMarketplaceDefault: boolean;
}

export interface AdminCommissionsResult {
  marketplaceDefault: number | null;
  sellers: AdminCommissionRate[];
}

/**
 * GET /admin/payouts/:id — deliberately the ONE admin-marketplace
 * response that's a raw Prisma row, not run through toPublicPayout/
 * toPublicLedgerEntry (see AdminPayoutsController.payoutDetail) —
 * amount fields come back as STRINGS (Prisma Decimal's own JSON
 * serialization), verified directly against a live response before
 * writing this, not assumed.
 */
export interface AdminPayoutLedgerItem {
  id: string;
  payoutId: string;
  ledgerEntryId: string;
  createdAt: string;
  ledgerEntry: {
    id: string;
    sellerId: string;
    type: string;
    amount: string;
    referenceType: string | null;
    referenceId: string | null;
    note: string | null;
    createdAt: string;
  };
}

export interface AdminPayoutDetail {
  id: string;
  sellerId: string;
  status: string;
  amount: string;
  idempotencyKey: string;
  failureReason: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminPayoutLedgerItem[];
}

/** GET /analytics/marketplace. */
export interface MarketplaceAnalytics {
  gmv: {
    sellerGmv: number;
    foliaGmv: number;
    commissionCollected: number;
  };
  sellers: {
    total: number;
    byStatus: Record<string, number>;
  };
  topSellers: { sellerId: string; displayName: string; revenue: number }[];
  pending: {
    sellersAwaitingReview: number;
    productsAwaitingReview: number;
    payoutsPending: number;
  };
}
