import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/** The "View all" link at the end of a section heading, with a comfortable tap area. */
export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="-mr-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-fern-dark transition-colors hover:text-heading">
      {children}
    </Link>
  );
}
