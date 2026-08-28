import { useQuery } from '@tanstack/react-query';
import { fetchCollectionBySlug } from '@/services/categoryService';

export function useCollection(slug: string | undefined) {
  return useQuery({
    queryKey: ['collection', slug],
    queryFn: () => fetchCollectionBySlug(slug!),
    enabled: !!slug,
    retry: false, // a 404 here just means the slug is a real category, not a curated collection — not worth retrying
  });
}
