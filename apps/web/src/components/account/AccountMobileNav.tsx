import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { accountNavItems } from './accountNavItems';
import { cn } from '@/utils/cn';

interface AccountMobileNavProps {
  onLogoutClick: () => void;
}

export function AccountMobileNav({ onLogoutClick }: AccountMobileNavProps) {
  return (
    <nav aria-label="Account" className="md:hidden -mx-4 px-4 mb-8 overflow-x-auto">
      <div className="flex gap-2 w-max">
        {accountNavItems.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'inline-flex min-h-11 items-center px-4 py-1.5 rounded-full text-[15px] border whitespace-nowrap transition-colors',
                isActive ? 'bg-pine text-cream-light border-pine' : 'border-stone-dark text-ink-soft'
              )
            }
          >
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onLogoutClick}
          className="flex items-center gap-1.5 min-h-11 px-4 py-1.5 rounded-full text-[15px] border border-rust/40 text-rust-text whitespace-nowrap transition-colors hover:bg-rust-light"
        >
          <LogOut size={14} />
          Log out
        </button>
      </div>
    </nav>
  );
}
