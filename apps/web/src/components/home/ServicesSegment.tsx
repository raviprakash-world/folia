import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';
import { SectionLink } from '@/components/common/SectionLink';
import { ServiceCards } from '@/components/services/ServiceCards';

export function ServicesSegment() {
  return (
    <Container className="py-8 sm:py-12">
      <SectionHeading title="Gardening help & corporate gifts" action={<SectionLink to="/services">All services</SectionLink>} />
      <ServiceCards />
    </Container>
  );
}
