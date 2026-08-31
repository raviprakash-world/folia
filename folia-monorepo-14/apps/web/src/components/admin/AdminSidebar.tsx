import { NavLink } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { cn } from '@/utils/cn';
import { adminNavItems } from './adminNavItems';

interface AdminSidebarProps {
  onLogoutClick: () => void;
}

export function AdminSidebar({ onLogoutClick }: AdminSidebarProps) {
  return (
    <nav aria-label="Admin" className="hidden md:flex flex-col gap-1 w-56 shrink-0">
      <div className="flex items-center gap-2 px-3 py-2 mb-2">
        <ShieldCheck size={16} className="text-fern" />
        <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">Admin</span>
      </div>
      {adminNavItems.map(({ to, label, Icon, end }) => (
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
