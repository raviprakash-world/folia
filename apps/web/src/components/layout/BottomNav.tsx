import { Link, useLocation } from 'react-router-dom';
import { House, Package, Search, Store, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

interface Item {
  label: string;
  Icon: LucideIcon;
  to?: string;
  active: (path: string) => boolean;
}

const items: Item[] = [
  { label: 'Home', Icon: House, to: '/', active: (p) => p === '/' },
  { label: 'Shop', Icon: Store, to: '/shop', active: (p) => p.startsWith('/shop') || p.startsWith('/collections') || p.startsWith('/offers') },
  { label: 'Search', Icon: Search, active: (p) => p.startsWith('/search') },
  { label: 'Orders', Icon: Package, to: '/account/orders', active: (p) => p.startsWith('/account/orders') },
  { label: 'Account', Icon: User, to: '/account', active: (p) => p.startsWith('/account') && !p.startsWith('/account/orders') },
];

/** Phone-only primary navigation. Cart stays in the header, always visible. */
export function BottomNav() {
  const { pathname } = useLocation();
  const openSearchOverlay = useUIStore((s) => s.openSearchOverlay);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-dark bg-stone-light/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map(({ label, Icon, to, active }) => {
          const isActive = active(pathname);
          const inner = (
            <>
              <span
                aria-hidden="true"
                className={cn('absolute inset-x-5 top-0 h-0.5 rounded-full transition-opacity', isActive ? 'bg-fern opacity-100' : 'opacity-0')}
              />
              <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} aria-hidden="true" />
              <span className={cn('text-xs leading-none', isActive ? 'font-semibold' : 'font-medium')}>{label}</span>
            </>
          );
          const cls = cn(
            'relative flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 transition-colors',
            isActive ? 'text-heading' : 'text-ink-soft hover:text-heading'
          );
          return (
            <li key={label} className="flex-1">
              {to ? (
                <Link to={to} aria-current={isActive ? 'page' : undefined} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={openSearchOverlay} className={cls}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
