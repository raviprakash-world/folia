import { useState } from 'react';
import { Search } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { BlogCard } from '@/components/blog/BlogCard';
import { FeaturedPost } from '@/components/blog/FeaturedPost';
import { useBlogList, useFeaturedPost } from '@/hooks/useBlog';
import { blogCategories } from '@/data/blog';
import { cn } from '@/utils/cn';

export default function BlogList() {
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const featured = useFeaturedPost();
  const { items, total, totalPages } = useBlogList({ category, search, page });

  function handleCategoryClick(next: string | undefined) {
    setCategory(next);
    setPage(1);
  }

  return (
    <Container className="py-16">
      <PageHeader
        eyebrow="The journal"
        title="Notes on plant care & design"
        description="Practical guides, honest myth-busting, and the occasional strong opinion about drainage holes."
      />

      {!category && !search && featured && <FeaturedPost post={featured} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleCategoryClick(undefined)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm border transition-colors',
              !category ? 'bg-pine text-stone-light border-pine' : 'border-stone-dark text-ink-soft hover:border-fern'
            )}
          >
            All
          </button>
          {blogCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryClick(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                category === cat ? 'bg-pine text-stone-light border-pine' : 'border-stone-dark text-ink-soft hover:border-fern'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search articles…"
            aria-label="Search articles"
            className="w-full rounded-[var(--radius-control)] border border-stone-dark bg-stone-light pl-9 pr-3 py-2 text-sm focus:border-fern transition-colors"
          />
        </div>
      </div>

      {total === 0 ? (
        <EmptyState title="No articles match" description="Try a different search term or category." />
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {items.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}
    </Container>
  );
}
