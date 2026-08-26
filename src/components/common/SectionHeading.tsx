import type { ReactNode } from 'react';

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}

export function SectionHeading({ eyebrow, title, action }: SectionHeadingProps) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div>
        {eyebrow && (
          <p className="font-mono text-xs uppercase tracking-wider text-fern mb-2">{eyebrow}</p>
        )}
        <h2 className="font-display text-3xl font-semibold text-pine">{title}</h2>
      </div>
      {action}
    </div>
  );
}
