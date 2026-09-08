import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Upload } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { Tag } from '@/components/ui/Tag';
import type { TagTone } from '@/components/ui/Tag';
import {
  useSellerProfile,
  useUpdateSellerProfile,
  useSellerVerifications,
  useUploadSellerVerification,
  useRealSellersApi,
} from '@/hooks/useSellerProfile';
import { sellerStatusTone, sellerStatusLabel } from '@/utils/sellerStatus';
import { formatDate } from '@/utils/currency';
import type { SellerVerification } from '@/types/sellerDashboard';

const verificationStatusTone: Record<SellerVerification['status'], TagTone> = {
  PENDING: 'ochre',
  APPROVED: 'pine',
  REJECTED: 'rust',
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function VerificationDocuments() {
  const { verifications, isLoading } = useSellerVerifications();
  const upload = useUploadSellerVerification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentType, setDocumentType] = useState('');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !documentType.trim()) return;
    void upload.mutateAsync({ documentType: documentType.trim(), files: Array.from(files) }).then(() => {
      setDocumentType('');
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="mt-12">
      <h2 className="font-display text-lg font-semibold text-heading mb-1">Verification documents</h2>
      <p className="text-sm text-ink-soft mb-4">
        Business registration, GST certificate, or other documents an admin may ask for to verify your account.
      </p>

      {isLoading ? (
        <p className="text-sm text-ink-soft py-4">Loading…</p>
      ) : verifications.length === 0 ? (
        <p className="text-sm text-ink-soft mb-4">No documents uploaded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2 mb-5">
          {verifications.map((v) => (
            <li key={v.id} className="flex items-center gap-3 text-sm">
              <Tag tone={verificationStatusTone[v.status]}>{v.status}</Tag>
              <a href={v.documentUrl} target="_blank" rel="noreferrer" className="text-fern underline">
                {v.documentType}
              </a>
              <span className="text-xs text-ink-soft">{formatDate(v.createdAt)}</span>
              {v.note && <span className="text-xs text-ink-soft">— {v.note}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex flex-col gap-1.5 flex-1">
          <label htmlFor="verification-document-type" className="text-sm font-medium text-ink-soft">
            Document type
          </label>
          <input
            id="verification-document-type"
            type="text"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            placeholder="e.g. business-registration"
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm"
          />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload verification document"
        />
        <Button
          variant="outline"
          icon={<Upload size={14} />}
          disabled={!documentType.trim() || upload.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {upload.isPending ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
      {upload.isError && (
        <Alert tone="error" className="mt-3">
          {errorMessage(upload.error, 'Could not upload that document.')}
        </Alert>
      )}
    </div>
  );
}

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

      <VerificationDocuments />
    </div>
  );
}
