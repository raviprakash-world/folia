import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap mb-12">
      <div>
        {eyebrow && <p className="font-mono text-xs uppercase tracking-wider text-fern mb-2">{eyebrow}</p>}
        <h1 className="font-display text-4xl font-semibold text-heading">{title}</h1>
        {description && <p className="text-ink-soft mt-2 max-w-[60ch]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
