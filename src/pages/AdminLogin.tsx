import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/common/FormField';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Alert } from '@/components/common/Alert';
import { useAuthStore } from '@/store/authStore';
import { loginSchema } from '@/utils/validation';
import type { LoginFormValues } from '@/utils/validation';

/**
 * Reuses the exact same authStore.login action and loginSchema as the
 * customer login page — not a parallel auth mechanism. What's different is
 * the post-login destination and a role check: a real (non-admin) customer
 * account can authenticate successfully here, but is immediately signed
 * back out with an explanatory error rather than left in a confusing
 * half-logged-in state on the admin login screen.
 */
export default function AdminLogin() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
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
    if (!user) return;
    if (user.role === 'admin') {
      void navigate('/admin', { replace: true });
    } else {
      void logout();
    }
  }, [user, navigate, logout]);

  async function onSubmit(values: LoginFormValues) {
    await login(values.email, values.password);
  }

  return (
    <Container className="py-20 max-w-sm">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={20} className="text-fern" />
        <h1 className="font-display text-3xl font-semibold text-heading">Admin sign in</h1>
      </div>
      <p className="text-sm text-ink-soft mt-2">
        Demo admin: <span className="font-mono">admin@folia.example</span> /{' '}
        <span className="font-mono">folia-admin</span>
      </p>

      {error && (
        <Alert tone="error" className="mt-5">
          {error}
        </Alert>
      )}
      {user && user.role !== 'admin' && (
        <Alert tone="error" className="mt-5">
          That account doesn't have admin access.
        </Alert>
      )}

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col gap-5 mt-6">
        <FormField label="Email" type="email" error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Password" error={errors.password?.message} {...register('password')} />
        <Button type="submit" variant="primary" size="lg" disabled={status === 'pending'} icon={<ShieldCheck size={16} />}>
          {status === 'pending' ? 'Signing in…' : 'Sign in to admin'}
        </Button>
      </form>
    </Container>
  );
}
