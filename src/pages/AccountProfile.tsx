import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/common/PageHeader';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { useAuthStore } from '@/store/authStore';

const profileSchema = z.object({
  firstName: z.string().min(1, 'Enter your first name').max(60),
  lastName: z.string().min(1, 'Enter your last name').max(60),
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function AccountProfile() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: user?.firstName ?? '', lastName: user?.lastName ?? '', email: user?.email ?? '' },
  });

  if (!user) return null;

  async function onSubmit(values: ProfileFormValues) {
    setSaved(false);
    const ok = await updateProfile(values);
    if (ok) setSaved(true);
  }

  return (
    <div className="max-w-md">
      <PageHeader title="My Profile" description="Update your name and email address." />

      {saved && (
        <Alert tone="success" className="mb-5">
          Profile updated.
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
        <div className="grid grid-cols-2 gap-4">
          <FormField label="First name" error={errors.firstName?.message} {...register('firstName')} />
          <FormField label="Last name" error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <FormField label="Email" type="email" error={errors.email?.message} {...register('email')} />
        <Button type="submit" variant="primary" disabled={status === 'pending'} className="self-start">
          {status === 'pending' ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
