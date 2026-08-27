import { useSearchParams, Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { ProductGrid } from '@/components/product/ProductGrid';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/Button';
import { products } from '@/data/products';

export default function Search() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const normalized = query.toLowerCase();

  const results = normalized
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(normalized) ||
          p.category.toLowerCase().includes(normalized) ||
          p.description.toLowerCase().includes(normalized)
      )
    : [];

  return (
    <Container className="py-16">
      <h1 className="font-display text-3xl font-semibold text-pine mb-2">
        {query ? `Results for "${query}"` : 'Search'}
      </h1>
      {query && (
        <p className="text-sm text-ink-soft mb-10 font-mono">
          {results.length} {results.length === 1 ? 'result' : 'results'}
        </p>
      )}

      {!query && (
        <EmptyState
          title="Search for something"
          description="Use the search icon in the header to find plants, vessels, and tools."
        />
      )}

      {query && results.length === 0 && (
        <EmptyState
          title={`No results for "${query}"`}
          description="Try a broader term, or browse the full shop."
          action={
            <Button variant="outline">
              <Link to="/shop">Browse the shop</Link>
            </Button>
          }
        />
      )}

      {results.length > 0 && <ProductGrid products={results} view="grid" />}
    </Container>
  );
}
