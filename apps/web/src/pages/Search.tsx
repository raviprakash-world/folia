import { Link, useSearchParams } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductGridSkeleton } from '@/components/product/ProductGridSkeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { ButtonLink } from '@/components/ui/ButtonLink';
import { useProducts } from '@/hooks/useProducts';
import { POPULAR_SEARCHES } from '@/data/popularSearches';

function SuggestionChips({ terms }: { terms: string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {terms.map((term) => (
        <Link
          key={term}
          to={`/search?q=${encodeURIComponent(term)}`}
          className="inline-flex min-h-10 items-center rounded-full border border-stone-dark px-3.5 py-1.5 text-[15px] text-ink-soft transition-colors hover:border-fern"
        >
          {term}
        </Link>
      ))}
    </div>
  );
}

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const { data, isLoading, isError, refetch } = useProducts({ search: query, pageSize: 24 }, { enabled: query.length > 0 });
  const results = data?.items ?? [];

  return (
    <Container className="py-6 sm:py-16">
      <h1 className="mb-2 font-display text-3xl font-semibold text-heading">{query ? `Results for “${query}”` : 'Search'}</h1>
      {query && data && (
        <p className="mb-6 text-sm text-ink-soft sm:mb-10" aria-live="polite">
          {data.total} {data.total === 1 ? 'result' : 'results'}
        </p>
      )}

      {!query && (
        <EmptyState title="What are you looking for?" description="Search for plants, planters, fertiliser and gardening tools, or start with a popular search.">
          <SuggestionChips terms={POPULAR_SEARCHES} />
        </EmptyState>
      )}

      {query && isLoading && <ProductGridSkeleton count={8} />}

      {query && isError && <ErrorState title="Something went wrong" description="We couldn't run that search right now." onRetry={() => void refetch()} />}

      {query && data && results.length === 0 && (
        <EmptyState
          title="We couldn’t find that plant"
          description="Check the spelling, or try one of these:"
          action={
            <ButtonLink variant="outline" to="/shop">
              Browse the shop
            </ButtonLink>
          }
        >
          <SuggestionChips terms={POPULAR_SEARCHES.slice(0, 5)} />
        </EmptyState>
      )}

      {results.length > 0 && <ProductGrid products={results} view="grid" />}
    </Container>
  );
}
