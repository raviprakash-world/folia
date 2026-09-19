import { Link } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { ServiceCards } from '@/components/services/ServiceCards';

export function ServicesSegment() {
  return (
    <Container className="py-20">
      <SectionHeading
        eyebrow="Services"
        title="Gardening help & corporate gifts"
        action={
          <Link to="/services" className="text-sm font-medium text-fern hover:text-heading transition-colors">
            All services
          </Link>
        }
      />
      <ServiceCards />
    </Container>
  );
}
