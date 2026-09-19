import { cn } from '@/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-pine text-cream-light hover:bg-pine-light active:bg-pine dark:bg-fern dark:text-pine dark:hover:bg-fern-light dark:active:bg-fern',
  secondary: 'bg-ochre text-pine hover:bg-ochre-light active:bg-ochre',
  ghost: 'bg-transparent text-heading hover:bg-stone-dark',
  outline: 'bg-transparent text-heading border border-pine dark:border-fern hover:bg-pine hover:text-cream-light dark:hover:bg-fern dark:hover:text-pine',
};

export const sizeStyles: Record<ButtonSize, string> = {
  sm: 'min-h-10 text-sm px-3.5 py-1.5 gap-1.5',
  md: 'min-h-11 text-[15px] px-5 py-2.5 gap-2',
  lg: 'min-h-12 text-base px-7 py-3 gap-2.5',
};

/** The same look as <Button>, for navigation: a real link, whole-surface tappable. */
export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center font-medium rounded-[var(--radius-control)]',
    'transition-colors duration-150 ease-out',
    variantStyles[variant],
    sizeStyles[size],
    className
  );
}

