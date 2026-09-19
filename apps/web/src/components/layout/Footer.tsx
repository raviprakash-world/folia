import { Link } from 'react-router-dom';
import { AtSign, Play, Rss } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { Container } from '@/components/ui/Container';
import { NewsletterForm } from '@/components/forms/NewsletterForm';

const columns = [
  {
    heading: 'Shop',
    links: [
      { label: 'All plants', to: '/shop' },
      { label: 'Collections', to: '/collections' },
      { label: 'Offers', to: '/offers' },
      { label: 'Gifting', to: '/collections/gifting' },
      { label: 'Gardening services', to: '/services/gardening' },
      { label: 'Corporate gifts', to: '/corporate-gifting' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', to: '/about' },
      { label: 'Journal', to: '/blog' },
      { label: 'Contact', to: '/contact' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'FAQ', to: '/faq' },
      { label: 'Shipping policy', to: '/policies/shipping' },
      { label: 'Returns', to: '/policies/returns' },
      { label: 'Privacy policy', to: '/policies/privacy' },
      { label: 'Terms & conditions', to: '/policies/terms' },
      { label: 'Photo credits', to: '/policies/photo-credits' },
    ],
  },
];

const socials = [
  { label: 'Instagram', href: 'https://instagram.com', Icon: AtSign },
  { label: 'YouTube', href: 'https://youtube.com', Icon: Play },
  { label: 'Journal RSS', href: '/blog/rss.xml', Icon: Rss },
];

export function Footer() {
  return (
    <footer className="bg-pine text-cream mt-24">
      <Container className="py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 md:col-span-2">
            <Logo tone="light" />
            <p className="mt-4 text-sm text-cream/70 max-w-[24ch]">
              Living design for the home.
            </p>
            <div className="mt-6 flex gap-3">
              {socials.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 rounded-full border border-cream-light/15 text-cream/70 hover:text-cream hover:border-cream-light/40 transition-colors"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="font-mono text-xs uppercase tracking-wider text-cream/65 mb-4">
                {col.heading}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-sm text-cream/85 hover:text-cream transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="col-span-2 md:col-span-1">
            <h3 className="font-mono text-xs uppercase tracking-wider text-cream/65 mb-4">
              Stay in the loop
            </h3>
            <NewsletterForm />
          </div>
        </div>
        <div className="mt-14 pt-6 border-t border-stone/15 flex flex-col sm:flex-row justify-between gap-2 text-xs text-cream/65">
          <p>&copy; {new Date().getFullYear()} Folia. Portfolio project — not a real store.</p>
          <p>Made for demonstration purposes.</p>
        </div>
      </Container>
    </footer>
  );
}
