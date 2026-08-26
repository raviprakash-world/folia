import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Search, Heart, ShoppingBag, Menu, X } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { Container } from '@/components/ui/Container';
import { MobileNav } from './MobileNav';

const primaryLinks = [
  { label: 'Shop', to: '/shop' },
  { label: 'Collections', to: '/collections' },
  { label: 'Journal', to: '/blog' },
  { label: 'About', to: '/about' },
];

/**
 * Sticky top nav. Mega-menu content, live search drawer, and real cart/wishlist
 * counts land in Phase 2 (nav polish) and Phase 4 (state) respectively — this
 * is the structural shell every page renders inside of.
 */
export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-stone-light/95 backdrop-blur border-b border-stone-dark">
      <Container className="flex items-center justify-between h-16">
        <Link to="/" aria-label="Folia home">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden md:flex items-center gap-8">
          {primaryLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `text-sm font-medium transition-colors ${
                  isActive ? 'text-pine' : 'text-ink-soft hover:text-pine'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Search"
            className="p-2.5 rounded-[var(--radius-control)] text-ink-soft hover:text-pine hover:bg-stone-dark transition-colors"
          >
            <Search size={20} />
          </button>
          <Link
            to="/wishlist"
            aria-label="Wishlist"
            className="p-2.5 rounded-[var(--radius-control)] text-ink-soft hover:text-pine hover:bg-stone-dark transition-colors"
          >
            <Heart size={20} />
          </Link>
          <Link
            to="/cart"
            aria-label="Shopping bag"
            className="relative p-2.5 rounded-[var(--radius-control)] text-ink-soft hover:text-pine hover:bg-stone-dark transition-colors"
          >
            <ShoppingBag size={20} />
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2.5 rounded-[var(--radius-control)] text-ink-soft hover:text-pine hover:bg-stone-dark transition-colors"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </Container>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} links={primaryLinks} />
    </header>
  );
}
