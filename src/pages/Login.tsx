import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/common/FormField';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Alert } from '@/components/common/Alert';
import { useAuthStore } from '@/store/authStore';
import { loginSchema } from '@/utils/validation';
import type { LoginFormValues } from '@/utils/validation';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const user = useAuthStore((s) => s.user);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: true },
  });

  useEffect(() => {
    if (user) {
      const from = (location.state as { from?: Location })?.from?.pathname ?? '/account';
      void navigate(from, { replace: true });
    }
  }, [user, navigate, location.state]);

  async function onSubmit(values: LoginFormValues) {
    await login(values.email, values.password);
  }

  return (
    <Container className="py-20 max-w-sm">
      <h1 className="font-display text-3xl font-semibold text-pine">Sign in</h1>
      <p className="text-sm text-ink-soft mt-2">
        Demo account: <span className="font-mono">demo@folia.example</span> / <span className="font-mono">folia-demo</span>
      </p>

      {error && (
        <Alert tone="error" className="mt-5">
          {error}
        </Alert>
      )}

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col gap-5 mt-6">
        <FormField label="Email" type="email" error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Password" error={errors.password?.message} {...register('password')} />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer text-ink-soft">
            <input type="checkbox" className="w-4 h-4 accent-fern" {...register('rememberMe')} onChange={() => clearError()} />
            Remember me
          </label>
          <Link to="/account/forgot-password" className="text-fern hover:text-pine transition-colors">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" disabled={status === 'pending'} icon={<LogIn size={16} />}>
          {status === 'pending' ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="text-sm text-ink-soft mt-6 text-center">
        New here? <Link to="/account/register" className="text-fern hover:text-pine transition-colors">Create an account</Link>
      </p>
    </Container>
  );
}
