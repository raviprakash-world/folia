import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/common/PageHeader';
import { ServiceCards } from '@/components/services/ServiceCards';

export default function Services() {
  return (
    <Container className="py-8 sm:py-16">
      <PageHeader
        eyebrow="Services"
        title="Beyond the shop"
        description="Help with your garden and gifting at scale. Tell us what you need and our team will reply with a quote."
      />
      <ServiceCards />
    </Container>
  );
}
