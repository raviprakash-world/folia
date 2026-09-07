import { useQuery } from '@tanstack/react-query';
import { fetchSellerStorefront, fetchSellers } from '@/services/sellerStorefrontService';
import type { SellerDirectoryQuery } from '@/types/seller';

export function useSellerStorefront(slug: string | undefined) {
  return useQuery({
    queryKey: ['seller-storefront', slug],
    queryFn: () => fetchSellerStorefront(slug!),
    enabled: !!slug,
  });
}

/** Marketplace Phase 16 — the public sellers directory. */
export function useSellers(query: SellerDirectoryQuery) {
  return useQuery({
    queryKey: ['sellers', query],
    queryFn: () => fetchSellers(query),
  });
}
