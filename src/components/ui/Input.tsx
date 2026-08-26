import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hideLabel?: boolean;
}

/**
 * Every field carries a real <label>, and errors are wired via aria-describedby
 * and aria-invalid — not just a red border. This is the field primitive Phase 5's
 * React Hook Form + Zod forms will register() into.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hideLabel = false, id, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className={cn('text-sm font-medium text-ink-soft', hideLabel && 'sr-only')}
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'rounded-[var(--radius-control)] border bg-stone-light px-3.5 py-2.5 text-sm',
            'text-ink placeholder:text-ink-soft/50',
            'transition-colors duration-150',
            error ? 'border-rust' : 'border-stone-dark focus:border-fern',
            className
          )}
          {...props}
        />
        {error && (
          <p id={errorId} role="alert" className="text-xs text-rust">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
