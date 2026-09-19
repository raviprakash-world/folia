import { Flower2, HeartPulse, Sprout, Sun } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/common/PageHeader';
import { GardeningEnquiryForm } from '@/components/services/GardeningEnquiryForm';

const helpWith = [
  { Icon: Sun, title: 'Balcony & terrace gardens', text: 'Plants and planters chosen for your light, your space and your pets.' },
  { Icon: Sprout, title: 'Regular plant-care visits', text: 'Watering, feeding, pruning and pest checks on a schedule that suits you.' },
  { Icon: HeartPulse, title: 'Health check & rescue', text: 'A plant that is drooping, yellowing or dropping leaves? We will look at what is going wrong.' },
  { Icon: Flower2, title: 'Repotting & soil refresh', text: 'The right pot size, fresh mix and good drainage, done properly.' },
];

const steps = [
  'Tell us about your space and what you need using the form below.',
  'Our team reviews it and gets back to you by email or phone with questions and a quote.',
  'If you are happy with the quote, we agree a date together.',
];

export default function GardeningServices() {
  return (
    <Container className="py-8 sm:py-16 max-w-4xl">
      <PageHeader
        eyebrow="Services"
        title="Gardening services"
        description="Hands-on help for homes with plants, from a first balcony garden to a plant that needs rescuing."
      />

      <section aria-labelledby="help-with" className="mb-14">
        <h2 id="help-with" className="font-display text-2xl font-semibold text-heading mb-6">
          What we can help with
        </h2>
        <div className="grid sm:grid-cols-2 gap-5">
          {helpWith.map(({ Icon, title, text }) => (
            <div key={title} className="flex items-start gap-4 rounded-[var(--radius-card)] border border-stone-dark bg-stone-light p-5">
              <Icon size={22} className="text-fern shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-ink">{title}</h3>
                <p className="text-sm text-ink-soft mt-1">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="how-it-works" className="mb-14">
        <h2 id="how-it-works" className="font-display text-2xl font-semibold text-heading mb-6">
          How it works
        </h2>
        <ol className="flex flex-col gap-3 list-decimal pl-5 text-ink-soft marker:text-fern marker:font-mono">
          {steps.map((step) => (
            <li key={step} className="pl-2">
              {step}
            </li>
          ))}
        </ol>
        <p className="text-sm text-ink-soft mt-4">
          Prices depend on the size of the space and the work involved, so every service is quoted. Nothing is charged on this page.
        </p>
      </section>

      <section aria-labelledby="enquire">
        <h2 id="enquire" className="font-display text-2xl font-semibold text-heading mb-6">
          Tell us about your space
        </h2>
        <GardeningEnquiryForm />
      </section>
    </Container>
  );
}
