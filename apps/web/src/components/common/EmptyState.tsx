import type { ReactNode } from 'react';
import { PackageSearch } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
  /** Replaces the default icon (e.g. a plant or heart for a friendlier empty cart / wishlist). */
  icon?: ReactNode;
  /** Extra content under the action, e.g. suggested searches. */
  children?: ReactNode;
}

export function EmptyState({ title, description, action, icon, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-2 py-14 text-center sm:py-20">
      <div className="mb-4 text-fern" aria-hidden="true">
        {icon ?? <PackageSearch size={40} className="text-ink-soft/50" />}
      </div>
      <h3 className="font-display text-2xl font-semibold text-heading">{title}</h3>
      <p className="mt-2 max-w-[40ch] text-[15px] leading-relaxed text-ink-soft">{description}</p>
      {action && <div className="mt-6">{action}</div>}
      {children && <div className="mt-6 w-full max-w-md">{children}</div>}
    </div>
  );
}
