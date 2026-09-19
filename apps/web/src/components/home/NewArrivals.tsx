import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { SectionLink } from '@/components/common/SectionLink';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { newArrivals } from '@/data/homepage';

export function NewArrivals() {
  return (
    <Container className="py-8 sm:py-12">
      <SectionHeading title="New arrivals" action={<SectionLink to="/shop?sort=newest">View all</SectionLink>} />
      <ProductCarousel products={newArrivals} />
    </Container>
  );
}
