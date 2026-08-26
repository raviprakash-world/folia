import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Search, Heart, ShoppingBag, Menu, X, ChevronDown } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { Container } from '@/components/ui/Container';
import { MobileNav } from './MobileNav';
import { MegaMenu } from './MegaMenu';
import { SearchDrawer } from './SearchDrawer';

const primaryLinks = [
  { label: 'Collections', to: '/collections' },
  { label: 'Journal', to: '/blog' },
  { label: 'About', to: '/about' },
];

/**
 * Sticky top nav with a mega menu on "Shop" and a full search drawer.
 * Cart/wishlist counts stay stubbed at 0 until Phase 4 wires the Zustand stores.
 */
export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="relative sticky top-0 z-40 bg-stone-light/95 backdrop-blur border-b border-stone-dark">
      <Container className="flex items-center justify-between h-16">
        <Link to="/" aria-label="Folia home">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden md:flex items-center gap-8">
          <button
            type="button"
            aria-expanded={megaMenuOpen}
            onClick={() => setMegaMenuOpen((v) => !v)}
            className={`flex items-center gap-1 text-sm font-medium transition-colors ${
              megaMenuOpen ? 'text-pine' : 'text-ink-soft hover:text-pine'
            }`}
          >
            Shop
            <ChevronDown size={14} className={`transition-transform ${megaMenuOpen ? 'rotate-180' : ''}`} />
          </button>
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
            onClick={() => setSearchOpen(true)}
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

      <MegaMenu open={megaMenuOpen} onClose={() => setMegaMenuOpen(false)} />
      <MobileNav
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        links={[{ label: 'Shop', to: '/shop' }, ...primaryLinks]}
      />
      <SearchDrawer open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
