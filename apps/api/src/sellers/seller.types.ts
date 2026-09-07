import type { Seller, SellerAddress, SellerVerification } from '@prisma/client';

export interface SellerAddressRecord {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

function toSellerAddress(
  address: SellerAddress | null,
): SellerAddressRecord | null {
  if (!address) return null;
  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    city: address.city,
    state: address.state,
    country: address.country,
    postalCode: address.postalCode,
  };
}

/**
 * The shape returned by GET /sellers/me — the caller's own full profile.
 * A distinct type from the eventual public storefront shape (Marketplace
 * Phase 4, which strips contactEmail/contactPhone/internal ids — see
 * docs/MARKETPLACE_PHASE0_ARCHITECTURE_ASSESSMENT.md §4), even though
 * today it's close to a 1:1 mirror of the Prisma row — never returning a
 * raw Prisma row directly from a controller matches this codebase's
 * existing convention (see e.g. users/user.types.ts's toPublicUser,
 * orders/returns.service.ts's toAdminRecord/getMyClaim). userId is
 * deliberately excluded — it's an internal linkage, not something this
 * response needs to expose.
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
  address: SellerAddressRecord | null;
  appliedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  /** The applicant-facing reason, when status is REJECTED — surfaced here
   * (not only in the admin view) since the applicant needs to know why to
   * act on "update application while allowed." */
  rejectionNote: string | null;
  suspendedAt: Date | null;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toSellerProfile(
  seller: Seller & { address: SellerAddress | null },
): SellerProfile {
  return {
    id: seller.id,
    slug: seller.slug,
    displayName: seller.displayName,
    description: seller.description,
    logoUrl: seller.logoUrl,
    contactEmail: seller.contactEmail,
    contactPhone: seller.contactPhone,
    status: seller.status,
    address: toSellerAddress(seller.address),
    appliedAt: seller.appliedAt,
    approvedAt: seller.approvedAt,
    rejectedAt: seller.rejectedAt,
    rejectionNote: seller.rejectionNote,
    suspendedAt: seller.suspendedAt,
    deactivatedAt: seller.deactivatedAt,
    createdAt: seller.createdAt,
    updatedAt: seller.updatedAt,
  };
}

export interface SellerVerificationRecord {
  id: string;
  documentType: string;
  documentUrl: string;
  status: SellerVerification['status'];
  reviewedBy: string | null;
  reviewedAt: Date | null;
  note: string | null;
  createdAt: Date;
}

export function toSellerVerification(
  v: SellerVerification,
): SellerVerificationRecord {
  return {
    id: v.id,
    documentType: v.documentType,
    documentUrl: v.documentUrl,
    status: v.status,
    reviewedBy: v.reviewedBy,
    reviewedAt: v.reviewedAt,
    note: v.note,
    createdAt: v.createdAt,
  };
}

/**
 * The admin queue/detail shape — everything SellerProfile has, plus
 * moderation fields (statusNote) and verification documents. Deliberately
 * still excludes bank-account data (SellerBankAccount isn't collected
 * until the payout phase — see docs/MARKETPLACE_PHASE0_ARCHITECTURE_ASSESSMENT.md
 * §9) — nothing to include or exclude yet.
 */
export interface AdminSellerRecord extends SellerProfile {
  userId: string;
  statusNote: string | null;
  verifications: SellerVerificationRecord[];
}

export function toAdminSellerRecord(
  seller: Seller & {
    address: SellerAddress | null;
    verifications: SellerVerification[];
  },
): AdminSellerRecord {
  return {
    ...toSellerProfile(seller),
    userId: seller.userId,
    statusNote: seller.statusNote,
    verifications: seller.verifications.map(toSellerVerification),
  };
}
