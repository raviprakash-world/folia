import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type CardVariant = 'flat' | 'raised';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, string> = {
  flat: 'bg-stone-light border border-stone-dark',
  raised: 'bg-stone-light shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-lifted)]',
};

export function Card({ variant = 'flat', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] transition-shadow duration-200 ease-out',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
