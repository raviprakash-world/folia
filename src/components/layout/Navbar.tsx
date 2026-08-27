import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Search, Heart, ShoppingBag, Menu, X, ChevronDown, User } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { Container } from '@/components/ui/Container';
import { MobileNav } from './MobileNav';
import { MegaMenu } from './MegaMenu';
import { SearchDrawer } from './SearchDrawer';
import { useCartItemCount } from '@/hooks/useCart';
import { useWishlistCount } from '@/hooks/useWishlist';
import { useCurrentUser } from '@/hooks/useAuth';
import { useUIStore } from '@/store/uiStore';

const primaryLinks = [
  { label: 'Collections', to: '/collections' },
  { label: 'Journal', to: '/blog' },
  { label: 'About', to: '/about' },
];

function NavBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-ochre text-pine text-[10px] font-mono font-medium">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/** Sticky top nav with a mega menu on "Shop", a full search drawer, and live cart/wishlist counts. */
export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const cartCount = useCartItemCount();
  const wishlistCount = useWishlistCount();
  const user = useCurrentUser();
  const openCartDrawer = useUIStore((s) => s.openCartDrawer);

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
          <Link
            to={user ? '/account' : '/account/login'}
            aria-label={user ? `Account — ${user.firstName}` : 'Sign in'}
            className="p-2.5 rounded-[var(--radius-control)] text-ink-soft hover:text-pine hover:bg-stone-dark transition-colors"
          >
            <User size={20} />
          </Link>
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
            aria-label={`Wishlist${wishlistCount > 0 ? ` (${wishlistCount} items)` : ''}`}
            className="relative p-2.5 rounded-[var(--radius-control)] text-ink-soft hover:text-pine hover:bg-stone-dark transition-colors"
          >
            <Heart size={20} />
            <NavBadge count={wishlistCount} />
          </Link>
          <button
            type="button"
            aria-label={`Shopping bag${cartCount > 0 ? ` (${cartCount} items)` : ''}`}
            onClick={openCartDrawer}
            className="relative p-2.5 rounded-[var(--radius-control)] text-ink-soft hover:text-pine hover:bg-stone-dark transition-colors"
          >
            <ShoppingBag size={20} />
            <NavBadge count={cartCount} />
          </button>
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
