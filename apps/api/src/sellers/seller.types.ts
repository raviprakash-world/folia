import type { Seller } from '@prisma/client';

/**
 * The shape returned by GET /sellers/me — the caller's own full profile.
 * A distinct type from the eventual public storefront shape (Marketplace
 * Phase 4, which strips contactEmail/contactPhone/internal ids — see
 * docs/MARKETPLACE_PHASE0_ARCHITECTURE_ASSESSMENT.md §4) and the admin
 * shape (which will additionally surface verification/moderation fields),
 * even though today it's close to a 1:1 mirror of the Prisma row — never
 * returning a raw Prisma row directly from a controller matches this
 * codebase's existing convention (see e.g. users/user.types.ts's
 * toPublicUser, orders/returns.service.ts's toAdminRecord/getMyClaim).
 * userId is deliberately excluded — it's an internal linkage, not
 * something this response needs to expose.
 */
export interface SellerProfile {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  status: Seller['status'];
  appliedAt: Date;
  approvedAt: Date | null;
  suspendedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toSellerProfile(seller: Seller): SellerProfile {
  return {
    id: seller.id,
    slug: seller.slug,
    displayName: seller.displayName,
    description: seller.description,
    logoUrl: seller.logoUrl,
    contactEmail: seller.contactEmail,
    contactPhone: seller.contactPhone,
    status: seller.status,
    appliedAt: seller.appliedAt,
    approvedAt: seller.approvedAt,
    suspendedAt: seller.suspendedAt,
    createdAt: seller.createdAt,
    updatedAt: seller.updatedAt,
  };
}
