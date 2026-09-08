import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { useAuthStore } from '@/store/authStore';
import { useApplyAsSeller } from '@/hooks/useSellerProfile';

/**
 * Marketplace Phase 15 — the one entry point that makes the seller
 * dashboard reachable for anyone other than the pre-seeded demo account:
 * POST /sellers/apply (apps/api/src/sellers/sellers.controller.ts) is not
 * gated by @RequireSeller() and assigns the real 'seller' role to the
 * caller's own account the moment they apply (SellersService.apply) —
 * before that, ProtectedRoute requireRole="seller" would never let them
 * into /seller/* at all. Deliberately outside that gated block (any
 * logged-in customer can reach this — see routes/index.tsx).
 */
const applySchema = z.object({
  displayName: z.string().min(2, 'Enter your storefront name').max(80),
  description: z.string().min(20, 'Tell customers a bit more about your storefront (20+ characters)').max(2000),
  contactEmail: z.string().min(1, 'Enter a contact email').email('Enter a valid email address'),
  contactPhone: z.string().min(6, 'Enter a contact phone number').max(20),
  addressLine1: z.string().min(1, 'Enter your address'),
  city: z.string().min(1, 'Enter your city'),
  state: z.string().min(1, 'Enter your state'),
  country: z.string().min(1, 'Enter your country'),
  postalCode: z.string().min(1, 'Enter your postal code'),
});

type ApplyFormValues = z.infer<typeof applySchema>;

export default function SellerApply() {
  const navigate = useNavigate();
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const applyMutation = useApplyAsSeller();
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ApplyFormValues>({ resolver: zodResolver(applySchema) });

  async function onSubmit(values: ApplyFormValues) {
    await applyMutation.mutateAsync({
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
    // The apply call just assigned the real 'seller' role server-side —
    // refresh the cached session so ProtectedRoute requireRole="seller"
    // lets the very next navigation through.
    await refreshSession();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="max-w-md py-20 mx-auto text-center">
        <Store size={28} className="text-fern mx-auto mb-4" />
        <h1 className="font-display text-2xl font-semibold text-heading mb-2">Application submitted</h1>
        <p className="text-sm text-ink-soft mb-6">
          We've received your seller application. You can track its status and set up your storefront right away —
          you won't be able to list live products until an admin approves it.
        </p>
        <Button variant="primary" onClick={() => void navigate('/seller')}>
          Go to your seller dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-16">
      <PageHeader
        eyebrow="Become a seller"
        title="Apply to sell on Folia"
        description="Tell us about your storefront. An admin will review your application before you can list products."
      />

      {applyMutation.isError && (
        <Alert tone="error" className="mb-5">
          {applyMutation.error instanceof Error ? applyMutation.error.message : 'Could not submit your application.'}
        </Alert>
      )}

      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col gap-5">
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
        <Button type="submit" variant="primary" size="lg" disabled={applyMutation.isPending} className="self-start">
          {applyMutation.isPending ? 'Submitting…' : 'Submit application'}
        </Button>
      </form>
    </div>
  );
}
