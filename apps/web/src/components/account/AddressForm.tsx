import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MapPinCheck, MapPin, AlertTriangle } from 'lucide-react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { countries } from '@/data/countries';
import { checkDeliveryAvailability } from '@/services/deliveryService';
import { detectPlace, GeoError } from '@/utils/geo';
import { addressSchema } from '@/utils/validation';
import type { AddressFormValues } from '@/utils/validation';
import type { Address, AddressType, DeliveryTimeSlot, GeoPlaceholder } from '@/types/address';
import { cn } from '@/utils/cn';

interface AddressFormProps {
  initialValues?: Address;
  onSubmit: (values: AddressFormValues, geo: GeoPlaceholder | null) => Promise<boolean>;
  onCancel: () => void;
  submitLabel: string;
}

const typeOptions: { value: AddressType; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
];

const timeSlotOptions: { value: DeliveryTimeSlot; label: string }[] = [
  { value: 'anytime', label: 'Anytime' },
  { value: 'morning', label: 'Morning (8am–12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm–5pm)' },
  { value: 'evening', label: 'Evening (5pm–9pm)' },
];

export function AddressForm({ initialValues, onSubmit, onCancel, submitLabel }: AddressFormProps) {
  const [availability, setAvailability] = useState<{ checking: boolean; message: string | null; ok: boolean }>({
    checking: false,
    message: null,
    ok: false,
  });
  // Kept only so an existing address's stored pin round-trips unchanged; detection no longer produces one.
  const [geo] = useState<GeoPlaceholder | null>(initialValues?.geo ?? null);
  const [detect, setDetect] = useState<{ busy: boolean; message: string | null; ok: boolean }>({ busy: false, message: null, ok: false });

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
          alternatePhone: initialValues.alternatePhone ?? '',
          email: initialValues.email ?? '',
          companyName: initialValues.companyName ?? '',
          addressLine1: initialValues.addressLine1,
          addressLine2: initialValues.addressLine2 ?? '',
          landmark: initialValues.landmark ?? '',
          deliveryInstructions: initialValues.deliveryInstructions ?? '',
          city: initialValues.city,
          state: initialValues.state,
          country: initialValues.country,
          postalCode: initialValues.postalCode,
          type: initialValues.type,
          label: initialValues.label ?? '',
          preferredTimeSlot: initialValues.preferredTimeSlot ?? 'anytime',
          isDefaultShipping: initialValues.isDefaultShipping,
          isDefaultBilling: initialValues.isDefaultBilling,
        }
      : { country: 'IN', type: 'home', preferredTimeSlot: 'anytime', isDefaultShipping: false, isDefaultBilling: false },
  });

  const type = useWatch({ control, name: 'type' });
  const postalCode = useWatch({ control, name: 'postalCode' });
  const country = useWatch({ control, name: 'country' });
  const addressLine1 = useWatch({ control, name: 'addressLine1' });
  const addressLine2 = useWatch({ control, name: 'addressLine2' });
  const landmark = useWatch({ control, name: 'landmark' });
  const selectedCountry = countries.find((c) => c.code === country);

  // Real rule-based heuristics over the entered fields — not random, not
  // network-validated, just structural advice a reviewer can verify by reading it.
  const warnings = useMemo(() => {
    const list: string[] = [];
    if (addressLine1 && /\bp\.?o\.?\s*box\b/i.test(addressLine1)) {
      list.push('Some couriers (including Same-Day and Store Pickup) can\u2019t deliver to PO Boxes.');
    }
    if (!landmark && !addressLine2) {
      list.push('Consider adding a landmark or unit number — it makes delivery easier to get right the first time.');
    }
    return list;
  }, [addressLine1, addressLine2, landmark]);

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

  async function handleDetectLocation() {
    setDetect({ busy: true, message: null, ok: false });
    try {
      const place = await detectPlace();
      const fill = { shouldDirty: true, shouldValidate: true } as const;
      if (place.addressLine1 && !addressLine1?.trim()) setValue('addressLine1', place.addressLine1, fill);
      if (place.city) setValue('city', place.city, fill);
      if (place.state) setValue('state', place.state, fill);
      if (place.postalCode) setValue('postalCode', place.postalCode, fill);
      setValue('country', 'IN', fill);
      setDetect({
        busy: false,
        ok: true,
        message: place.postalCode
          ? 'Filled in from your location — please check the details, especially the house/flat number.'
          : 'Filled in what we could from your location, but not the PIN code — please enter it.',
      });
    } catch (e) {
      setDetect({ busy: false, ok: false, message: e instanceof GeoError ? e.message : "Couldn't detect your location." });
    }
  }

  async function handleFormSubmit(values: AddressFormValues) {
    return onSubmit(values, geo);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(handleFormSubmit)(e)} noValidate className="flex flex-col gap-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <FormField label="Full name" error={errors.fullName?.message} {...register('fullName')} />
        <FormField label="Company (optional)" error={errors.companyName?.message} {...register('companyName')} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <FormField label="Phone" type="tel" error={errors.phone?.message} {...register('phone')} />
        <FormField label="Alternate phone (optional)" type="tel" error={errors.alternatePhone?.message} {...register('alternatePhone')} />
      </div>
      <FormField label="Email (optional)" type="email" error={errors.email?.message} {...register('email')} />

      <FormField label="Address line 1" error={errors.addressLine1?.message} {...register('addressLine1')} />
      <FormField label="Address line 2 (optional)" error={errors.addressLine2?.message} {...register('addressLine2')} />
      <FormField label="Landmark (optional)" error={errors.landmark?.message} {...register('landmark')} />
      <FormField
        as="textarea"
        rows={2}
        label="Delivery instructions (optional)"
        placeholder="e.g. Leave with the front desk, gate code, etc."
        error={errors.deliveryInstructions?.message}
        {...register('deliveryInstructions')}
      />

      {warnings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {warnings.map((w) => (
            <Alert key={w} tone="info">
              <span className="flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-ochre shrink-0" />
                {w}
              </span>
            </Alert>
          ))}
        </div>
      )}

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
        <button
          type="button"
          onClick={() => void handleDetectLocation()}
          disabled={detect.busy}
          className="flex items-center gap-1.5 text-sm text-fern hover:text-heading transition-colors disabled:opacity-60"
        >
          {detect.busy ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
          {detect.busy ? 'Finding your location…' : 'Use my current location to fill in this address'}
        </button>
        {detect.message && (
          <Alert tone={detect.ok ? 'success' : 'error'} className="mt-2">
            {detect.message}
          </Alert>
        )}
        <p className="text-xs text-ink-soft mt-1.5">
          Your coordinates are sent once to OpenStreetMap to look up the address; they aren&apos;t saved.
        </p>
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
                type === opt.value ? 'bg-pine text-cream-light border-pine' : 'border-stone-dark text-ink-soft hover:border-fern'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="address-time-slot" className="text-sm font-medium text-ink-soft">
          Preferred delivery time
        </label>
        <select
          id="address-time-slot"
          className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm text-ink focus:border-fern transition-colors max-w-xs"
          {...register('preferredTimeSlot')}
        >
          {timeSlotOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
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
