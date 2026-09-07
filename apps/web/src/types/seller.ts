/**
 * Marketplace Phase 4 — matches the backend's PublicSellerStorefront shape
 * exactly (apps/api/src/sellers/seller.types.ts). Deliberately narrow —
 * see that type's own comment for exactly what's excluded and why
 * (contact info, address, internal ids).
 */
export interface SellerStorefront {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  logoUrl: string | null;
  productCount: number;
  averageRating: number | null;
}
