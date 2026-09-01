import { NavLink } from 'react-router-dom';
import { accountNavItems } from './accountNavItems';
import { cn } from '@/utils/cn';

export function AccountMobileNav() {
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
                'px-3.5 py-1.5 rounded-full text-sm border whitespace-nowrap transition-colors',
                isActive ? 'bg-pine text-stone-light border-pine' : 'border-stone-dark text-ink-soft'
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
