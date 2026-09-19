import { AnimatePresence, motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

interface MobileNavLink {
  label: string;
  to: string;
}

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  links: MobileNavLink[];
  /** Extra rows rendered after the links (e.g. the appearance switch). */
  children?: ReactNode;
}

export function MobileNav({ open, onClose, links, children }: MobileNavProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.nav
          aria-label="Mobile"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="lg:hidden max-h-[calc(100dvh-8rem)] overflow-y-auto border-t border-stone-dark bg-stone-light"
        >
          <ul className="flex flex-col px-4 py-2">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center text-base font-medium border-b border-stone-dark/60 last:border-0 ${
                      isActive ? 'text-heading' : 'text-ink-soft'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
            {children}
          </ul>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
