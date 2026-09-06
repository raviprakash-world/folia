import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/common/FormField';
import { Alert } from '@/components/common/Alert';
import { requestPasswordReset } from '@/services/authService';
import { forgotPasswordSchema } from '@/utils/validation';
import type { ForgotPasswordFormValues } from '@/utils/validation';

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordFormValues) {
    setErrorMessage(null);
    try {
      const { devToken: token } = await requestPasswordReset(values.email);
      setDevToken(token ?? null);
      setSubmitted(true);
    } catch {
      setErrorMessage("Something went wrong sending the reset link — try again in a moment.");
    }
  }

  if (submitted) {
    return (
      <Container className="py-20 max-w-sm text-center">
        <Mail size={28} className="text-fern mx-auto mb-4" />
        <h1 className="font-display text-2xl font-semibold text-heading">Check your email</h1>
        <p className="text-sm text-ink-soft mt-2">
          If an account exists for that address, a reset link is on its way.
        </p>
        {devToken && (
          <div className="mt-6 p-4 rounded-[var(--radius-control)] bg-stone-dark/40 text-left">
            <p className="text-xs text-ink-soft mb-2">
              A real reset email was sent. This dev-only link is shown here too since local
              development doesn't always have a real inbox to check:
            </p>
            <Link
              to={`/account/reset-password?token=${devToken}`}
              className="text-sm text-fern hover:text-heading underline break-all"
            >
              Continue to reset password
            </Link>
          </div>
        )}
      </Container>
    );
  }

  return (
    <Container className="py-20 max-w-sm">
      <h1 className="font-display text-3xl font-semibold text-heading">Reset your password</h1>
      <p className="text-sm text-ink-soft mt-2">Enter your email and we'll send a link to reset it.</p>

      {errorMessage && (
        <Alert tone="error" className="mt-5">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col gap-5 mt-6">
        <FormField label="Email" type="email" error={errors.email?.message} {...register('email')} />
        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>

      <p className="text-sm text-ink-soft mt-6 text-center">
        <Link to="/account/login" className="text-fern hover:text-heading transition-colors">Back to sign in</Link>
      </p>
    </Container>
  );
}
