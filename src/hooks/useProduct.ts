import { useQuery } from '@tanstack/react-query';
import { fetchProductBySlug, fetchRelatedProducts } from '@/services/productService';

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => fetchProductBySlug(slug!),
    enabled: !!slug,
  });
}

export function useRelatedProducts(slug: string | undefined) {
  return useQuery({
    queryKey: ['product', slug, 'related'],
    queryFn: () => fetchRelatedProducts(slug!),
    enabled: !!slug,
  });
}
