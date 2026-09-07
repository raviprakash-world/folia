import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/common/PageHeader';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { Tag } from '@/components/ui/Tag';
import { useSellerProfile, useUpdateSellerProfile, useRealSellersApi } from '@/hooks/useSellerProfile';
import { sellerStatusTone, sellerStatusLabel } from '@/utils/sellerStatus';

const profileSchema = z.object({
  displayName: z.string().min(2).max(80),
  description: z.string().min(20).max(2000),
  contactEmail: z.string().min(1).email('Enter a valid email address'),
  contactPhone: z.string().min(6).max(20),
  addressLine1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().min(1),
  postalCode: z.string().min(1),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function SellerProfile() {
  const { profile, isLoading } = useSellerProfile();
  const updateMutation = useUpdateSellerProfile();
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (!profile) return;
    reset({
      displayName: profile.displayName,
      description: profile.description,
      contactEmail: profile.contactEmail,
      contactPhone: profile.contactPhone,
      addressLine1: profile.address?.addressLine1 ?? '',
      city: profile.address?.city ?? '',
      state: profile.address?.state ?? '',
      country: profile.address?.country ?? '',
      postalCode: profile.address?.postalCode ?? '',
    });
  }, [profile, reset]);

  if (!useRealSellersApi) {
    return (
      <div>
        <PageHeader title="Profile" />
        <p className="text-sm text-ink-soft">
          The seller dashboard requires the real backend (set <code>VITE_REAL_SELLERS_API=true</code>).
        </p>
      </div>
    );
  }

  if (isLoading || !profile) {
    return (
      <div>
        <PageHeader title="Profile" />
        <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
      </div>
    );
  }

  async function onSubmit(values: ProfileFormValues) {
    setSaved(false);
    await updateMutation.mutateAsync({
      displayName: values.displayName,
      description: values.description,
      contactEmail: values.contactEmail,
      contactPhone: values.contactPhone,
      address: {
        addressLine1: values.addressLine1,
        addressLine2: null,
        city: values.city,
        state: values.state,
        country: values.country,
        postalCode: values.postalCode,
      },
    });
    setSaved(true);
  }

  return (
    <div className="max-w-lg">
      <PageHeader
        title="Storefront profile"
        description="This is what customers see on your public storefront."
        action={<Tag tone={sellerStatusTone[profile.status]}>{sellerStatusLabel[profile.status]}</Tag>}
      />

      {profile.status === 'REJECTED' && profile.rejectionNote && (
        <Alert tone="error" className="mb-6">
          Your application was not approved: {profile.rejectionNote}. You can update your details below and they'll
          be resubmitted for review.
        </Alert>
      )}
      {(profile.status === 'APPLIED' || profile.status === 'UNDER_REVIEW') && (
        <Alert tone="info" className="mb-6">
          Your application is being reviewed. You can keep editing your details in the meantime.
        </Alert>
      )}
      {profile.status === 'SUSPENDED' && (
        <Alert tone="error" className="mb-6">
          Your seller account is currently suspended. Contact support for details.
        </Alert>
      )}

      {saved && (
        <Alert tone="success" className="mb-5">
          Profile updated.
        </Alert>
      )}
      {updateMutation.isError && (
        <Alert tone="error" className="mb-5">
          {updateMutation.error instanceof Error ? updateMutation.error.message : 'Could not save your changes.'}
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
        <FormField label="Storefront name" error={errors.displayName?.message} {...register('displayName')} />
        <FormField
          as="textarea"
          rows={3}
          label="Description"
          error={errors.description?.message}
          {...register('description')}
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Contact email" type="email" error={errors.contactEmail?.message} {...register('contactEmail')} />
          <FormField label="Contact phone" error={errors.contactPhone?.message} {...register('contactPhone')} />
        </div>
        <FormField label="Address line 1" error={errors.addressLine1?.message} {...register('addressLine1')} />
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="City" error={errors.city?.message} {...register('city')} />
          <FormField label="State" error={errors.state?.message} {...register('state')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Country" error={errors.country?.message} {...register('country')} />
          <FormField label="Postal code" error={errors.postalCode?.message} {...register('postalCode')} />
        </div>
        <Button type="submit" variant="primary" disabled={updateMutation.isPending} className="self-start">
          {updateMutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  );
}
