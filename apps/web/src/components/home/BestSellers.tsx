import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { SectionLink } from '@/components/common/SectionLink';
import { ProductCard } from '@/components/product/ProductCard';
import { bestSellers } from '@/data/homepage';

export function BestSellers() {
  return (
    <Container className="py-8 sm:py-12">
      <SectionHeading title="Best sellers" action={<SectionLink to="/shop">View all</SectionLink>} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-x-5">
        {bestSellers.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </Container>
  );
}
