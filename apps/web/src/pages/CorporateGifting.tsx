import { Boxes, CalendarClock, MapPin } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/common/PageHeader';
import { ProductCard } from '@/components/product/ProductCard';
import { CorporateEnquiryForm } from '@/components/services/CorporateEnquiryForm';
import { useProducts } from '@/hooks/useProducts';

const points = [
  { Icon: Boxes, title: 'Plants and planters in bulk', text: 'Choose from what is in our shop, or ask about something specific.' },
  { Icon: MapPin, title: 'One address or many', text: 'Tell us where the gifts need to go and we will confirm what is possible.' },
  { Icon: CalendarClock, title: 'Planned around your date', text: 'Give us the date you need them by so we can check it works.' },
];

export default function CorporateGifting() {
  const { data } = useProducts({ collection: 'gifting', pageSize: 4 });

  return (
    <Container className="py-16 max-w-4xl">
      <PageHeader
        eyebrow="Services"
        title="Corporate gifts"
        description="Plants that last longer than a hamper. Tell us the occasion and how many, and we will send you a quote."
      />

      <section aria-labelledby="what-you-get" className="mb-14">
        <h2 id="what-you-get" className="font-display text-2xl font-semibold text-heading mb-6">
          What to expect
        </h2>
        <div className="grid sm:grid-cols-3 gap-5">
          {points.map(({ Icon, title, text }) => (
            <div key={title} className="rounded-[var(--radius-card)] border border-stone-dark bg-stone-light p-5">
              <Icon size={22} className="text-fern" />
              <h3 className="font-medium text-ink mt-3">{title}</h3>
              <p className="text-sm text-ink-soft mt-1">{text}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-ink-soft mt-4">Bulk orders are quoted individually. Nothing is charged on this page.</p>
      </section>

      {data && data.items.length > 0 && (
        <section aria-labelledby="popular" className="mb-14">
          <h2 id="popular" className="font-display text-2xl font-semibold text-heading mb-6">
            Popular for gifting
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {data.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="request-quote">
        <h2 id="request-quote" className="font-display text-2xl font-semibold text-heading mb-6">
          Request a quote
        </h2>
        <CorporateEnquiryForm />
      </section>
    </Container>
  );
}
