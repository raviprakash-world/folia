import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/utils/cn';
import { accountNavItems } from './accountNavItems';

interface AccountSidebarProps {
  onLogoutClick: () => void;
}

export function AccountSidebar({ onLogoutClick }: AccountSidebarProps) {
  return (
    <nav aria-label="Account" className="hidden md:flex flex-col gap-1 w-56 shrink-0">
      {accountNavItems.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-control)] text-sm transition-colors',
              isActive ? 'bg-pine text-stone-light' : 'text-ink-soft hover:bg-stone-dark hover:text-ink'
            )
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onLogoutClick}
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-control)] text-sm text-rust hover:bg-rust-light transition-colors mt-2"
      >
        <LogOut size={16} />
        Log out
      </button>
    </nav>
  );
}
