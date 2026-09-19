import { Link } from 'react-router-dom';
import { HeartPulse, MapPin, PackageCheck, RotateCcw } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/common/SectionHeading';

/** Every line here is backed by a policy page or a working feature. Nothing is a statistic. */
const points = [
  {
    Icon: HeartPulse,
    title: '30-day health guarantee',
    text: 'A plant that arrives unwell, or does not survive 30 days despite the care card, is replaced once.',
    to: '/policies/returns',
  },
  {
    Icon: PackageCheck,
    title: 'Packed for the journey',
    text: 'Live plants ship braced, in breathable packaging — not sealed in plastic.',
    to: '/policies/shipping',
  },
  {
    Icon: MapPin,
    title: 'Know before you buy',
    text: 'Enter your PIN code to see the estimated delivery time and shipping cost.',
    to: '/shop',
  },
  {
    Icon: RotateCcw,
    title: 'A clear return policy',
    text: 'Vessels and tools can be returned within 14 days. Read the policy in full.',
    to: '/policies/returns',
  },
];

export function WhyFolia() {
  return (
    <Container className="py-8 sm:py-12">
      <SectionHeading title="Why shop with Folia" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {points.map(({ Icon, title, text, to }) => (
          <li key={title}>
            <Link
              to={to}
              className="flex h-full gap-4 rounded-[var(--radius-card)] border border-stone-dark bg-stone-light p-4 transition-colors hover:border-fern lg:flex-col"
            >
              <Icon size={24} className="mt-0.5 shrink-0 text-fern" aria-hidden="true" />
              <span>
                <span className="block font-medium text-ink">{title}</span>
                <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
