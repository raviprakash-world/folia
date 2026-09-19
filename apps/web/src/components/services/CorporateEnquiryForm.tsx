import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react';
import { FormField } from '@/components/common/FormField';
import { SelectField } from '@/components/common/SelectField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { useEnquirySubmit } from '@/hooks/useEnquirySubmit';
import { giftingOccasions } from '@/data/services';
import { corporateEnquirySchema } from '@/utils/validation';
import type { CorporateEnquiryValues } from '@/utils/validation';

export function CorporateEnquiryForm() {
  const { status, errorMessage, send } = useEnquirySubmit();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CorporateEnquiryValues>({
    resolver: zodResolver(corporateEnquirySchema),
    defaultValues: { neededBy: '', city: '' },
  });

  async function onSubmit({ quantity, neededBy, city, ...rest }: CorporateEnquiryValues) {
    const saved = await send({
      type: 'CORPORATE_GIFTING',
      ...rest,
      quantity: Number(quantity),
      ...(neededBy && { neededBy }),
      ...(city && { city }),
    });
    if (saved) reset();
  }

  return (
    <div>
      {status === 'success' && (
        <Alert tone="success" className="mb-6">
          Thanks — your request is recorded. Our team will get back to you with next steps by email or phone.
        </Alert>
      )}
      {status === 'error' && (
        <Alert tone="error" className="mb-6">
          {errorMessage}
        </Alert>
      )}
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col gap-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label="Your name" autoComplete="name" error={errors.name?.message} {...register('name')} />
          <FormField label="Company" autoComplete="organization" error={errors.company?.message} {...register('company')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label="Work email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
          <FormField label="Phone" type="tel" autoComplete="tel" error={errors.phone?.message} {...register('phone')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label="Number of gifts" inputMode="numeric" error={errors.quantity?.message} {...register('quantity')} />
          <SelectField label="Occasion" options={giftingOccasions} error={errors.occasion?.message} {...register('occasion')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <FormField label="Needed by (optional)" type="date" error={errors.neededBy?.message} {...register('neededBy')} />
          <FormField label="Delivery city (optional)" error={errors.city?.message} {...register('city')} />
        </div>
        <FormField
          as="textarea"
          label="What do you have in mind?"
          rows={5}
          placeholder="Budget per gift, the kind of plant or planter you like, one address or many."
          error={errors.message?.message}
          {...register('message')}
        />
        <Button type="submit" size="lg" disabled={isSubmitting} icon={<Send size={16} />} className="self-start">
          {isSubmitting ? 'Sending…' : 'Request a quote'}
        </Button>
      </form>
    </div>
  );
}
