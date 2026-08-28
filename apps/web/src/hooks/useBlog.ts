import { useMemo } from 'react';
import { blogPosts } from '@/data/blog';

const PAGE_SIZE = 6;

interface BlogListParams {
  category?: string;
  search?: string;
  page: number;
}

export function useBlogList({ category, search, page }: BlogListParams) {
  return useMemo(() => {
    const normalized = search?.trim().toLowerCase();
    let filtered = blogPosts.filter((p) => !p.featured || category || normalized);

    if (category) filtered = filtered.filter((p) => p.category === category);
    if (normalized) {
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(normalized) ||
          p.excerpt.toLowerCase().includes(normalized) ||
          p.tags.some((t) => t.toLowerCase().includes(normalized))
      );
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = (page - 1) * PAGE_SIZE;
    const items = filtered.slice(start, start + PAGE_SIZE);

    return { items, total, totalPages };
  }, [category, search, page]);
}

export function useFeaturedPost() {
  return useMemo(() => blogPosts.find((p) => p.featured) ?? null, []);
}

export function useBlogPost(slug: string | undefined) {
  return useMemo(() => blogPosts.find((p) => p.slug === slug) ?? null, [slug]);
}

export function useRelatedPosts(slug: string | undefined, category: string | undefined) {
  return useMemo(() => {
    if (!slug || !category) return [];
    return blogPosts.filter((p) => p.category === category && p.slug !== slug).slice(0, 3);
  }, [slug, category]);
}
