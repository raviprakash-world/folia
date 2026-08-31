import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogOut } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { PasswordInput } from '@/components/common/PasswordInput';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { useNotificationStore } from '@/store/notificationStore';
import { changePasswordSchema } from '@/utils/validation';
import type { ChangePasswordFormValues } from '@/utils/validation';

export default function AccountSecurity() {
  const changePassword = useAuthStore((s) => s.changePassword);
  const logout = useAuthStore((s) => s.logout);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const showToast = useToastStore((s) => s.showToast);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(values: ChangePasswordFormValues) {
    setSaved(false);
    const ok = await changePassword(values.currentPassword, values.password);
    if (ok) {
      setSaved(true);
      reset();
      addNotification({ type: 'security', title: 'Password Changed', message: 'Your password was updated successfully.' });
    }
  }

  async function handleSignOutEverywhere() {
    await logout();
    showToast('info', "Signed out. (This mock has one session, so it's the same as a regular sign-out.)");
  }

  return (
    <div className="max-w-md">
      <PageHeader title="Security" description="Change your password or sign out of your session." />

      {saved && (
        <Alert tone="success" className="mb-5">
          Password updated.
        </Alert>
      )}
      {error && (
        <Alert tone="error" className="mb-5">
          {error}
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          setSaved(false);
          void handleSubmit(onSubmit)(e);
        }}
        noValidate
        className="flex flex-col gap-5"
      >
        <PasswordInput
          label="Current password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <PasswordInput label="New password" error={errors.password?.message} {...register('password')} />
        <PasswordInput
          label="Confirm new password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <p className="text-xs text-ink-soft -mt-2">At least 8 characters, with an uppercase letter and a number.</p>
        <Button type="submit" variant="primary" disabled={status === 'pending'} className="self-start">
          {status === 'pending' ? 'Updating…' : 'Update password'}
        </Button>
      </form>

      <div className="mt-10 pt-8 border-t border-stone-dark">
        <h2 className="text-sm font-medium text-ink mb-1">Sign out everywhere</h2>
        <p className="text-xs text-ink-soft mb-3">Ends your session on this device.</p>
        <Button variant="outline" size="sm" icon={<LogOut size={14} />} onClick={() => void handleSignOutEverywhere()}>
          Sign out everywhere
        </Button>
      </div>
    </div>
  );
}
