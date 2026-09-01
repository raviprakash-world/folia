import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ProductCarousel } from '@/components/product/ProductCarousel';
import { usePersonalizedRecommendations } from '@/hooks/useRecommendations';

export function RecommendedForYou() {
  const recommendations = usePersonalizedRecommendations();

  if (recommendations.length === 0) return null;

  return (
    <Container className="py-20">
      <SectionHeading
        eyebrow="Picked for you"
        title="Recommended for You"
        action={
          <Link to="/shop" className="text-sm font-medium text-fern hover:text-heading transition-colors">
            View all
          </Link>
        }
      />
      <ProductCarousel products={recommendations} />
    </Container>
  );
}
