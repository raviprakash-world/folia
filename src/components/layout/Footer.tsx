import { Link } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';
import { Container } from '@/components/ui/Container';

const columns = [
  {
    heading: 'Shop',
    links: [
      { label: 'All plants', to: '/shop' },
      { label: 'Collections', to: '/collections' },
      { label: 'Gift cards', to: '/shop/gift-cards' },
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
      { label: 'Shipping & returns', to: '/policies/shipping' },
      { label: 'Privacy policy', to: '/policies/privacy' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-pine text-stone mt-24">
      <Container className="py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <Logo tone="light" />
            <p className="mt-4 text-sm text-stone/70 max-w-[24ch]">
              Living design for the home.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="font-mono text-xs uppercase tracking-wider text-stone/50 mb-4">
                {col.heading}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.to}>
                    <Link to={link.to} className="text-sm text-stone/85 hover:text-stone transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 pt-6 border-t border-stone/15 flex flex-col sm:flex-row justify-between gap-2 text-xs text-stone/50">
          <p>&copy; {new Date().getFullYear()} Folia. Portfolio project — not a real store.</p>
          <p>Made for demonstration purposes.</p>
        </div>
      </Container>
    </footer>
  );
}
