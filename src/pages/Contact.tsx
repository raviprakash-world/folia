import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/common/PageHeader';
import { ContactForm } from '@/components/contact/ContactForm';
import { ContactInfo } from '@/components/contact/ContactInfo';

export default function Contact() {
  return (
    <Container className="py-16">
      <PageHeader
        eyebrow="Get in touch"
        title="Contact us"
        description="Questions about an order, a plant that's struggling, or anything else — we read every message."
      />
      <div className="grid lg:grid-cols-[1fr_360px] gap-12">
        <ContactForm />
        <ContactInfo />
      </div>
    </Container>
  );
}
