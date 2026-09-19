import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { SectionLink } from '@/components/common/SectionLink';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { planters } from '@/data/homepage';

export function Planters() {
  return (
    <div className="bg-stone-dark/40">
      <Container className="py-8 sm:py-12">
        <SectionHeading title="Planters & accessories" action={<SectionLink to="/collections/vessels">View all</SectionLink>} />
        <ProductCarousel products={planters} />
      </Container>
    </div>
  );
}
