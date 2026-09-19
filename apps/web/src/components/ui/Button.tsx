import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-pine text-cream-light hover:bg-pine-light active:bg-pine dark:bg-fern dark:text-pine dark:hover:bg-fern-light dark:active:bg-fern',
  secondary: 'bg-ochre text-pine hover:bg-ochre-light active:bg-ochre',
  ghost: 'bg-transparent text-heading hover:bg-stone-dark',
  outline: 'bg-transparent text-heading border border-pine dark:border-fern hover:bg-pine hover:text-cream-light dark:hover:bg-fern dark:hover:text-pine',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5 gap-1.5',
  md: 'text-sm px-5 py-2.5 gap-2',
  lg: 'text-base px-7 py-3.5 gap-2.5',
};

/**
 * Base interactive control. Every button in the app should route through this
 * rather than a bare <button> — keeps focus states, disabled states, and
 * variant styling consistent across the codebase.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon,
      iconPosition = 'left',
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-[var(--radius-control)]',
          'transition-colors duration-150 ease-out',
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {icon && iconPosition === 'left' && <span className="shrink-0">{icon}</span>}
        {children}
        {icon && iconPosition === 'right' && <span className="shrink-0">{icon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
