import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-6 sm:mb-12">
      <div>
        {eyebrow && <p className="font-mono text-xs uppercase tracking-wider text-fern-dark mb-2">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-semibold text-heading sm:text-4xl">{title}</h1>
        {description && <p className="text-ink-soft mt-2 max-w-[60ch]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
