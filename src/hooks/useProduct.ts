import { useQuery } from '@tanstack/react-query';
import { fetchProductBySlug } from '@/services/productService';

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => fetchProductBySlug(slug!),
    enabled: !!slug,
  });
}
