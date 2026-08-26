import type { ElementType, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface ContainerProps {
  children: ReactNode;
  as?: ElementType;
  narrow?: boolean;
  className?: string;
}

/** Centers content at the design system's standard content or narrow (article) width. */
export function Container({ children, as: Component = 'div', narrow = false, className }: ContainerProps) {
  return (
    <Component
      className={cn(
        'mx-auto px-4 sm:px-6 lg:px-8 w-full',
        narrow ? 'max-w-[var(--container-narrow)]' : 'max-w-[var(--container-content)]',
        className
      )}
    >
      {children}
    </Component>
  );
}
