import { useLocation } from 'react-router-dom';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/common/PageHeader';
import { ContactForm } from '@/components/contact/ContactForm';
import { ContactInfo } from '@/components/contact/ContactInfo';

interface ContactLocationState {
  subject?: string;
  message?: string;
}

export default function Contact() {
  const location = useLocation();
  const state = (location.state as ContactLocationState | null) ?? {};

  return (
    <Container className="py-16">
      <PageHeader
        eyebrow="Get in touch"
        title="Contact us"
        description="Questions about an order, a plant that's struggling, or anything else — we read every message."
      />
      <div className="grid lg:grid-cols-[1fr_360px] gap-12">
        <ContactForm defaultSubject={state.subject} defaultMessage={state.message} />
        <ContactInfo />
      </div>
    </Container>
  );
}
