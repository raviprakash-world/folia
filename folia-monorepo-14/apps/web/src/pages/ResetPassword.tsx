import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useSearchParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { CheckCircle2 } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Alert } from '@/components/common/Alert';
import { resetPassword } from '@/services/authService';
import { resetPasswordSchema } from '@/utils/validation';
import type { ResetPasswordFormValues } from '@/utils/validation';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordFormValues) {
    if (!token) return;
    setErrorMessage(null);
    try {
      await resetPassword(token, values.password);
      setSubmitted(true);
    } catch (error) {
      const message = isAxiosError<{ message?: string }>(error)
        ? (error.response?.data.message ?? 'That reset link is invalid or has expired.')
        : 'That reset link is invalid or has expired.';
      setErrorMessage(message);
    }
  }

  if (!token) {
    return (
      <Container className="py-20 max-w-sm text-center">
        <h1 className="font-display text-2xl font-semibold text-heading">Missing reset link</h1>
        <p className="text-sm text-ink-soft mt-2">
          This page needs a reset token from the email link.{' '}
          <Link to="/account/forgot-password" className="text-fern underline">Request a new one</Link>.
        </p>
      </Container>
    );
  }

  if (submitted) {
    return (
      <Container className="py-20 max-w-sm text-center">
        <CheckCircle2 size={28} className="text-fern mx-auto mb-4" />
        <h1 className="font-display text-2xl font-semibold text-heading">Password updated</h1>
        <p className="text-sm text-ink-soft mt-2">You can sign in with your new password now.</p>
        <Button variant="primary" className="mt-6">
          <Link to="/account/login">Sign in</Link>
        </Button>
      </Container>
    );
  }

  return (
    <Container className="py-20 max-w-sm">
      <h1 className="font-display text-3xl font-semibold text-heading">Set a new password</h1>

      {errorMessage && (
        <Alert tone="error" className="mt-5">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col gap-5 mt-6">
        <PasswordInput label="New password" error={errors.password?.message} {...register('password')} />
        <PasswordInput label="Confirm new password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <p className="text-xs text-ink-soft -mt-2">At least 8 characters, with an uppercase letter and a number.</p>
        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
          {isSubmitting ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </Container>
  );
}
