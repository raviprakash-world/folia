import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { FormField } from '@/components/common/FormField';
import { SelectField } from '@/components/common/SelectField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { useEnquirySubmit } from '@/hooks/useEnquirySubmit';
import { gardeningServiceTypes } from '@/data/services';
import { gardeningEnquirySchema } from '@/utils/validation';
import type { GardeningEnquiryValues } from '@/utils/validation';

export function GardeningEnquiryForm() {
  const { status, errorMessage, send } = useEnquirySubmit();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GardeningEnquiryValues>({ resolver: zodResolver(gardeningEnquirySchema) });

  async function onSubmit(values: GardeningEnquiryValues) {
    if (await send({ type: 'GARDENING_SERVICE', ...values })) reset();
  }

  return (
    <div>
      {status === 'success' && (
        <Alert tone="success" className="mb-6">
          Thanks — your enquiry is recorded. Our team will contact you by email or phone.
        </Alert>
      )}
      {status === 'error' && (
        <Alert tone="error" className="mb-6">
          {errorMessage}
        </Alert>
      )}
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col gap-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label="Name" autoComplete="name" error={errors.name?.message} {...register('name')} />
          <FormField label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label="Phone" type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
          <FormField label="City" error={errors.city?.message} {...register('city')} />
        </div>
        <SelectField label="What do you need?" options={gardeningServiceTypes} error={errors.serviceType?.message} {...register('serviceType')} />
        <FormField
          as="textarea"
          label="Tell us about your space"
          rows={5}
          placeholder="For example: a sunny 10 ft balcony, mostly empty, two cats at home."
          error={errors.message?.message}
          {...register('message')}
        />
        <Button type="submit" size="lg" disabled={isSubmitting} icon={<Send size={16} />} className="self-start">
          {isSubmitting ? 'Sending…' : 'Send enquiry'}
        </Button>
      </form>
    </div>
  );
}
