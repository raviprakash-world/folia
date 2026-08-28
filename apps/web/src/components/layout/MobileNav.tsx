import { AnimatePresence, motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';

interface MobileNavLink {
  label: string;
  to: string;
}

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
  links: MobileNavLink[];
}

export function MobileNav({ open, onClose, links }: MobileNavProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.nav
          aria-label="Mobile"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="md:hidden overflow-hidden border-t border-stone-dark bg-stone-light"
        >
          <ul className="flex flex-col px-4 py-2">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `block py-3 text-base font-medium border-b border-stone-dark/60 last:border-0 ${
                      isActive ? 'text-heading' : 'text-ink-soft'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
