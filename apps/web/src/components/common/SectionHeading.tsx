import type { ReactNode } from 'react';

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}

export function SectionHeading({ eyebrow, title, action }: SectionHeadingProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 font-mono text-xs uppercase tracking-wider text-fern-dark">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-semibold leading-tight text-heading sm:text-3xl">{title}</h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
