import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';

const promos = [
  {
    title: 'New: Statement Vessels',
    description: 'Hand-thrown stoneware, restocked for autumn.',
    to: '/collections/statement-vessels',
    tone: 'bg-fern text-stone-light',
  },
  {
    title: 'Gift a plant, not a guess',
    description: 'Gift cards never wilt.',
    to: '/shop/gift-cards',
    tone: 'bg-ochre text-pine',
  },
];

export function PromoBanners() {
  return (
    <Container className="py-20">
      <div className="grid sm:grid-cols-2 gap-6">
        {promos.map((promo) => (
          <Link
            key={promo.title}
            to={promo.to}
            className={`group rounded-[var(--radius-card)] p-8 flex flex-col justify-between min-h-[220px] ${promo.tone}`}
          >
            <div>
              <h3 className="font-display text-2xl font-semibold">{promo.title}</h3>
              <p className="text-sm opacity-80 mt-2">{promo.description}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium mt-6">
              Shop now
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </Container>
  );
}
