import { useQuery } from '@tanstack/react-query';
import { fetchSellerStorefront } from '@/services/sellerStorefrontService';

export function useSellerStorefront(slug: string | undefined) {
  return useQuery({
    queryKey: ['seller-storefront', slug],
    queryFn: () => fetchSellerStorefront(slug!),
    enabled: !!slug,
  });
}
