import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Check } from 'lucide-react';
import { newsletterSchema, type NewsletterFormValues } from '@/utils/validation';

/**
 * No newsletter API exists yet (that's a Phase 3+ concern), so submission
 * resolves locally after validating. The validation itself is real — this
 * isn't a fake input waiting to be wired up later, only the network call is.
 */
export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<NewsletterFormValues>({ resolver: zodResolver(newsletterSchema) });

  async function onSubmit() {
    await new Promise((resolve) => setTimeout(resolve, 400));
    setSubmitted(true);
    reset();
  }

  if (submitted) {
    return (
      <p className="flex items-center gap-2 text-sm text-stone">
        <Check size={16} className="text-ochre" />
        You're on the list.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(onSubmit)(e);
      }}
      noValidate
      className="flex flex-col gap-1.5 max-w-xs"
    >
      <label htmlFor="newsletter-email" className="text-xs text-stone/60">
        Get plant care notes, once a month. No spam.
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          placeholder="you@example.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'newsletter-email-error' : undefined}
          className="flex-1 min-w-0 rounded-[var(--radius-control)] bg-stone-light/10 border border-stone-light/20 px-3 py-2 text-sm text-stone placeholder:text-stone/40 focus:border-ochre transition-colors"
          {...register('email')}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          aria-label="Subscribe"
          className="shrink-0 flex items-center justify-center w-9 h-9 rounded-[var(--radius-control)] bg-ochre text-pine hover:bg-ochre-light transition-colors disabled:opacity-50"
        >
          <ArrowRight size={16} />
        </button>
      </div>
      {errors.email && (
        <p id="newsletter-email-error" role="alert" className="text-xs text-rust-light">
          {errors.email.message}
        </p>
      )}
    </form>
  );
}
