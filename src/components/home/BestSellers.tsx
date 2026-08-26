import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { bestSellers } from '@/data/homepage';

export function BestSellers() {
  return (
    <Container className="py-20">
      <SectionHeading
        eyebrow="Most loved"
        title="Best sellers"
        action={
          <Link to="/shop" className="text-sm font-medium text-fern hover:text-pine transition-colors">
            View all
          </Link>
        }
      />
      <ProductCarousel products={bestSellers} />
    </Container>
  );
}
