import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MapPinCheck } from 'lucide-react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { countries } from '@/data/countries';
import { checkDeliveryAvailability } from '@/services/deliveryService';
import { addressSchema } from '@/utils/validation';
import type { AddressFormValues } from '@/utils/validation';
import type { Address, AddressType } from '@/types/address';
import { cn } from '@/utils/cn';

interface AddressFormProps {
  initialValues?: Address;
  onSubmit: (values: AddressFormValues) => Promise<boolean>;
  onCancel: () => void;
  submitLabel: string;
}

const typeOptions: { value: AddressType; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
];

export function AddressForm({ initialValues, onSubmit, onCancel, submitLabel }: AddressFormProps) {
  const [availability, setAvailability] = useState<{ checking: boolean; message: string | null; ok: boolean }>({
    checking: false,
    message: null,
    ok: false,
  });

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: initialValues
      ? {
          fullName: initialValues.fullName,
          phone: initialValues.phone,
          email: initialValues.email ?? '',
          addressLine1: initialValues.addressLine1,
          addressLine2: initialValues.addressLine2 ?? '',
          landmark: initialValues.landmark ?? '',
          city: initialValues.city,
          state: initialValues.state,
          country: initialValues.country,
          postalCode: initialValues.postalCode,
          type: initialValues.type,
          label: initialValues.label ?? '',
          isDefaultShipping: initialValues.isDefaultShipping,
          isDefaultBilling: initialValues.isDefaultBilling,
        }
      : { country: 'US', type: 'home', isDefaultShipping: false, isDefaultBilling: false },
  });

  const type = useWatch({ control, name: 'type' });
  const postalCode = useWatch({ control, name: 'postalCode' });
  const country = useWatch({ control, name: 'country' });
  const selectedCountry = countries.find((c) => c.code === country);

  async function handleCheckAvailability() {
    if (!postalCode?.trim()) return;
    setAvailability({ checking: true, message: null, ok: false });
    try {
      const result = await checkDeliveryAvailability(postalCode.trim(), 0);
      const methods = result.options.map((o) => o.label).join(', ');
      setAvailability({ checking: false, ok: true, message: `Delivery available: ${methods}.` });
    } catch {
      setAvailability({ checking: false, ok: false, message: "Couldn't check availability — try again." });
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <FormField label="Full name" error={errors.fullName?.message} {...register('fullName')} />
        <FormField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
      </div>
      <FormField label="Email (optional)" type="email" error={errors.email?.message} {...register('email')} />

      <FormField label="Address line 1" error={errors.addressLine1?.message} {...register('addressLine1')} />
      <FormField label="Address line 2 (optional)" error={errors.addressLine2?.message} {...register('addressLine2')} />
      <FormField label="Landmark (optional)" error={errors.landmark?.message} {...register('landmark')} />

      <div className="grid sm:grid-cols-3 gap-4">
        <FormField label="City" error={errors.city?.message} {...register('city')} />
        <FormField label="State / Province" error={errors.state?.message} {...register('state')} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="address-country" className="text-sm font-medium text-ink-soft">
            Country
          </label>
          <select
            id="address-country"
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm text-ink focus:border-fern transition-colors"
            {...register('country')}
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormField
              label={selectedCountry?.postalLabel ?? 'Postal code'}
              error={errors.postalCode?.message}
              {...register('postalCode')}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => void handleCheckAvailability()}
            disabled={availability.checking || !postalCode?.trim()}
          >
            {availability.checking ? <Loader2 size={15} className="animate-spin" /> : 'Check delivery'}
          </Button>
        </div>
        {availability.message && (
          <Alert tone={availability.ok ? 'success' : 'error'} className="mt-2">
            <span className="flex items-center gap-1.5">
              {availability.ok && <MapPinCheck size={14} />}
              {availability.message}
            </span>
          </Alert>
        )}
      </div>

      <div>
        <p className="text-sm font-medium text-ink-soft mb-2">Address type</p>
        <div className="flex gap-2">
          {typeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue('type', opt.value)}
              aria-pressed={type === opt.value}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-sm border transition-colors',
                type === opt.value ? 'bg-pine text-stone-light border-pine' : 'border-stone-dark text-ink-soft hover:border-fern'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <FormField label="Nickname (optional)" placeholder="e.g. Mom's house" error={errors.label?.message} {...register('label')} />

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-fern" {...register('isDefaultShipping')} />
          <span className="text-ink-soft">Set as default shipping address</span>
        </label>
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-fern" {...register('isDefaultBilling')} />
          <span className="text-ink-soft">Set as default billing address</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
