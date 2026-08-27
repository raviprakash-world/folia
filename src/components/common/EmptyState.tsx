import type { ReactNode } from 'react';
import { PackageSearch } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-20">
      <PackageSearch size={36} className="text-ink-soft/40 mb-4" />
      <h3 className="font-display text-xl font-semibold text-pine">{title}</h3>
      <p className="text-sm text-ink-soft mt-2 max-w-[40ch]">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
