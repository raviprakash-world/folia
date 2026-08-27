import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { subscribeToNewsletter, NewsletterError } from '@/services/newsletterService';
import { newsletterSchema, type NewsletterFormValues } from '@/utils/validation';

/**
 * Real MSW-backed submission (src/mocks/contactHandlers.ts), including
 * duplicate-subscription handling — try "subscribed@example.com" to see it.
 */
export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
    reset,
  } = useForm<NewsletterFormValues>({ resolver: zodResolver(newsletterSchema) });

  async function onSubmit() {
    setErrorMessage(null);
    try {
      await subscribeToNewsletter(getValues('email'));
      setSubmitted(true);
      reset();
    } catch (error) {
      setErrorMessage(error instanceof NewsletterError ? error.message : 'Something went wrong — try again.');
    }
  }

  if (submitted) {
    return (
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center gap-2 text-sm text-stone"
      >
        <Check size={16} className="text-ochre" />
        You're on the list.
      </motion.p>
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
          aria-invalid={!!errors.email || !!errorMessage}
          aria-describedby={errors.email || errorMessage ? 'newsletter-email-error' : undefined}
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
      {(errors.email ?? errorMessage) && (
        <p id="newsletter-email-error" role="alert" className="text-xs text-rust-light">
          {errors.email?.message ?? errorMessage}
        </p>
      )}
    </form>
  );
}
