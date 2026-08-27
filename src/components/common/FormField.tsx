import { forwardRef } from 'react';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';
import { cn } from '@/utils/cn';

type BaseProps = {
  label: string;
  error?: string;
  hideLabel?: boolean;
};

type InputFieldProps = BaseProps &
  InputHTMLAttributes<HTMLInputElement> & { as?: 'input' };

type TextareaFieldProps = BaseProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { as: 'textarea' };

type FormFieldProps = InputFieldProps | TextareaFieldProps;

const fieldStyles =
  'rounded-[var(--radius-control)] border bg-stone-light px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft/50 transition-colors';

export const FormField = forwardRef<HTMLInputElement | HTMLTextAreaElement, FormFieldProps>(
  ({ label, error, hideLabel = false, id, className, ...props }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const errorId = `${fieldId}-error`;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className={cn('text-sm font-medium text-ink-soft', hideLabel && 'sr-only')}>
          {label}
        </label>
        {props.as === 'textarea' ? (
          <textarea
            ref={ref as React.Ref<HTMLTextAreaElement>}
            id={fieldId}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={cn(fieldStyles, error ? 'border-rust' : 'border-stone-dark focus:border-fern', className)}
            {...props}
          />
        ) : (
          <input
            ref={ref as React.Ref<HTMLInputElement>}
            id={fieldId}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className={cn(fieldStyles, error ? 'border-rust' : 'border-stone-dark focus:border-fern', className)}
            {...props}
          />
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs text-rust">
            {error}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';
