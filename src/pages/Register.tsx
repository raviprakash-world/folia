import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/common/FormField';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Alert } from '@/components/common/Alert';
import { useAuthStore } from '@/store/authStore';
import { registerSchema } from '@/utils/validation';
import type { RegisterFormValues } from '@/utils/validation';

export default function Register() {
  const navigate = useNavigate();
  const registerUser = useAuthStore((s) => s.register);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const user = useAuthStore((s) => s.user);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  useEffect(() => {
    if (user) void navigate('/account', { replace: true });
  }, [user, navigate]);

  async function onSubmit(values: RegisterFormValues) {
    await registerUser(values);
  }

  return (
    <Container className="py-20 max-w-sm">
      <h1 className="font-display text-3xl font-semibold text-pine">Create an account</h1>
      <p className="text-sm text-ink-soft mt-2">Or check out as a guest any time — an account just saves your order history.</p>

      {error && (
        <Alert tone="error" className="mt-5">
          {error}
        </Alert>
      )}

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col gap-5 mt-6">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="First name" error={errors.firstName?.message} {...register('firstName')} />
          <FormField label="Last name" error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <FormField label="Email" type="email" error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Password" error={errors.password?.message} {...register('password')} />
        <PasswordInput label="Confirm password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <p className="text-xs text-ink-soft -mt-2">At least 8 characters, with an uppercase letter and a number.</p>

        <Button type="submit" variant="primary" size="lg" disabled={status === 'pending'} icon={<UserPlus size={16} />}>
          {status === 'pending' ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="text-sm text-ink-soft mt-6 text-center">
        Already have an account? <Link to="/account/login" className="text-fern hover:text-pine transition-colors">Sign in</Link>
      </p>
    </Container>
  );
}
