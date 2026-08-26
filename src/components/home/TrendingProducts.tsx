import { Container } from '@/components/ui/Container';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { trending } from '@/data/homepage';

export function TrendingProducts() {
  return (
    <div className="bg-stone-dark/40 py-20">
      <Container>
        <div className="mb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-fern mb-2">
            Right now
          </p>
          <h2 className="font-display text-3xl font-semibold text-pine">Trending this week</h2>
        </div>
        <ProductCarousel products={trending} />
      </Container>
    </div>
  );
}
