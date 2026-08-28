import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Camera, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB — this is a mock, localStorage-backed upload, not real file storage

const profileSchema = z.object({
  firstName: z.string().min(1, 'Enter your first name').max(60),
  lastName: z.string().min(1, 'Enter your last name').max(60),
  email: z.string().min(1, 'Enter your email').email('Enter a valid email address'),
  phone: z.string().max(20).optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function AccountProfile() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
    },
  });

  if (!user) return null;

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);

    if (!file.type.startsWith('image/')) {
      setAvatarError('Choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image is too large — keep it under 2MB (this is a mock, browser-local upload).');
      return;
    }

    setAvatarLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(reader.result as string);
      setAvatarLoading(false);
    };
    reader.onerror = () => {
      setAvatarError('Could not read that file — try another image.');
      setAvatarLoading(false);
    };
    reader.readAsDataURL(file);
  }

  async function onSubmit(values: ProfileFormValues) {
    setSaved(false);
    const ok = await updateProfile({ ...values, phone: values.phone || undefined, avatarUrl });
    if (ok) {
      setSaved(true);
      addNotification({ type: 'account', title: 'Profile Updated', message: 'Your profile details were saved.' });
    }
  }

  return (
    <div className="max-w-md">
      <PageHeader title="My Profile" description="Update your name, contact details, and avatar." />

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

      <div className="flex items-center gap-4 mb-8">
        <div className="relative w-16 h-16 rounded-full bg-stone-dark overflow-hidden flex items-center justify-center shrink-0">
          {avatarLoading ? (
            <Loader2 size={18} className="animate-spin text-ink-soft" />
          ) : avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-lg text-ink-soft">{user.firstName[0]}</span>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
            aria-label="Upload avatar"
          />
          <Button variant="outline" size="sm" icon={<Camera size={14} />} onClick={() => fileInputRef.current?.click()}>
            Change photo
          </Button>
          <p className="text-xs text-ink-soft mt-1.5">Mock upload — stored only in your browser, under 2MB.</p>
          {avatarError && <p className="text-xs text-rust mt-1">{avatarError}</p>}
        </div>
      </div>

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
        <FormField label="Phone (optional)" type="tel" error={errors.phone?.message} {...register('phone')} />
        <Button type="submit" variant="primary" disabled={status === 'pending'} className="self-start">
          {status === 'pending' ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
