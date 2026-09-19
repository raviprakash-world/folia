import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Search, Heart, ShoppingBag, Menu, X, ChevronDown, User, Bell } from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { Container } from '@/components/ui/Container';
import { MobileNav } from './MobileNav';
import { MegaMenu } from './MegaMenu';
import { useCartItemCount } from '@/hooks/useCart';
import { useWishlistCount } from '@/hooks/useWishlist';
import { useCurrentUser } from '@/hooks/useAuth';
import { useUIStore } from '@/store/uiStore';
import { useUnreadNotificationCount } from '@/hooks/useNotifications';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { LocationBar } from '@/components/location/LocationPicker';

const primaryLinks = [
  { label: 'Collections', to: '/collections' },
  { label: 'Offers', to: '/offers' },
  { label: 'Services', to: '/services' },
  { label: 'Sellers', to: '/sellers' },
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
  const inCheckout = useLocation().pathname.startsWith('/checkout');
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  // Phones: the search row tucks away while reading down the page and returns on the first scroll up.
  const [condensed, setCondensed] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let travelled = 0; // distance scrolled in the current direction
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - last;
        last = y;
        frame = 0;
        if (dy === 0) return;
        travelled = Math.sign(dy) === Math.sign(travelled) ? travelled + dy : dy;
        if (y < 80 || travelled < -24) setCondensed(false);
        else if (travelled > 24) setCondensed(true);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  const cartCount = useCartItemCount();
  const wishlistCount = useWishlistCount();
  const user = useCurrentUser();
  const unreadCount = useUnreadNotificationCount();
  const openCartDrawer = useUIStore((s) => s.openCartDrawer);
  const openSearchOverlay = useUIStore((s) => s.openSearchOverlay);

  const searchHidden = condensed || inCheckout || mobileOpen;

  const iconBtn =
    'relative size-11 items-center justify-center rounded-[var(--radius-control)] text-ink-soft transition-colors hover:bg-stone-dark hover:text-heading';

  return (
    <>
      <header className="relative sticky top-0 z-40 border-b border-stone-dark bg-stone-light/95 backdrop-blur">
        <Container className="flex h-14 items-center justify-between gap-2 lg:h-16">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
              className={`${iconBtn} -ml-2.5 inline-flex lg:hidden`}
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <Link to="/" aria-label="Folia home" className="flex min-h-11 items-center">
              <Logo />
            </Link>
          </div>

          <nav aria-label="Primary" className="hidden lg:flex items-center gap-6 xl:gap-8">
            <button
              type="button"
              aria-expanded={megaMenuOpen}
              onClick={() => setMegaMenuOpen((v) => !v)}
              className={`flex items-center gap-1 text-sm font-medium transition-colors ${
                megaMenuOpen ? 'text-heading' : 'text-ink-soft hover:text-heading'
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
                  `text-sm font-medium transition-colors ${isActive ? 'text-heading' : 'text-ink-soft hover:text-heading'}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-0.5">
            <div className="hidden lg:block">
              <ThemeToggle compact />
            </div>
            <Link
              to={user ? '/account' : '/account/login'}
              aria-label={user ? `Account — ${user.firstName}` : 'Sign in'}
              className={`${iconBtn} hidden lg:inline-flex`}
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <User size={20} />
              )}
            </Link>
            <button type="button" aria-label="Search" onClick={openSearchOverlay} className={`${iconBtn} hidden gap-1.5 lg:inline-flex lg:w-auto lg:px-2.5`}>
              <Search size={20} />
              <kbd className="font-mono text-[10px] border border-stone-dark rounded px-1.5 py-0.5">⌘K</kbd>
            </button>
            <Link
              to="/account/notifications"
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
              className={`${iconBtn} hidden lg:inline-flex`}
            >
              <Bell size={20} />
              <NavBadge count={unreadCount} />
            </Link>
            <Link to="/wishlist" aria-label={`Wishlist${wishlistCount > 0 ? ` (${wishlistCount} items)` : ''}`} className={`${iconBtn} inline-flex`}>
              <Heart size={22} />
              <NavBadge count={wishlistCount} />
            </Link>
            <button type="button" aria-label={`Shopping bag${cartCount > 0 ? ` (${cartCount} items)` : ''}`} onClick={openCartDrawer} className={`${iconBtn} -mr-2.5 inline-flex lg:mr-0`}>
              <ShoppingBag size={22} />
              <NavBadge count={cartCount} />
            </button>
          </div>
        </Container>

        {/* Hangs below the header without taking layout space, so hiding or showing it can never move the page (moving the page is what made it flicker). */}
        <div className="pointer-events-none absolute inset-x-0 top-full h-[54px] overflow-hidden lg:hidden">
          <div
            inert={searchHidden}
            className={`pointer-events-auto border-b border-stone-dark bg-stone-light/95 backdrop-blur transition-transform duration-200 motion-reduce:transition-none ${searchHidden ? '-translate-y-full' : 'translate-y-0'}`}
          >
            <Container className="pb-2.5">
              <button
                type="button"
                onClick={openSearchOverlay}
                className="flex h-11 w-full items-center gap-3 rounded-full border border-stone-dark bg-stone px-4 text-left text-[15px] text-ink-soft transition-colors hover:border-fern"
              >
                <Search size={18} aria-hidden="true" className="shrink-0" />
                <span className="truncate">Search plants, planters &amp; more</span>
              </button>
            </Container>
          </div>
        </div>

        <MegaMenu open={megaMenuOpen} onClose={() => setMegaMenuOpen(false)} />
        <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} links={[{ label: 'Shop', to: '/shop' }, ...primaryLinks]}>
          <li className="flex items-center justify-between gap-3 py-3">
            <span className="text-base font-medium text-ink-soft">Appearance</span>
            <ThemeToggle compact />
          </li>
        </MobileNav>
      </header>
      {!inCheckout && <div aria-hidden="true" className="h-[54px] lg:hidden" />}
      {!inCheckout && <LocationBar />}
    </>
  );
}
