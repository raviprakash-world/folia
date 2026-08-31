import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreditCard } from 'lucide-react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { savedCards, banks } from '@/data/paymentMethods';
import { cn } from '@/utils/cn';
import { cardPaymentSchema, savedCardCvvSchema, upiPaymentSchema, netBankingSchema } from '@/utils/validation';
import type {
  CardPaymentFormValues,
  SavedCardCvvFormValues,
  UpiPaymentFormValues,
  NetBankingFormValues,
} from '@/utils/validation';

function PayButton({ processing }: { processing: boolean }) {
  return (
    <Button type="submit" variant="primary" size="lg" disabled={processing} className="self-start">
      {processing ? 'Processing…' : 'Pay now'}
    </Button>
  );
}

interface CardFormProps {
  onSubmit: (displayLabel: string) => void;
  processing: boolean;
}

export function NewCardForm({ onSubmit, processing }: CardFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CardPaymentFormValues>({ resolver: zodResolver(cardPaymentSchema) });

  function submit(values: CardPaymentFormValues) {
    const last4 = values.cardNumber.slice(-4);
    onSubmit(`Card •••• ${last4}`);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(submit)(e)} noValidate className="flex flex-col gap-4">
      <FormField label="Cardholder name" error={errors.cardholderName?.message} {...register('cardholderName')} />
      <FormField
        label="Card number"
        inputMode="numeric"
        placeholder="4242 4242 4242 4242"
        error={errors.cardNumber?.message}
        {...register('cardNumber')}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Expiry (MM/YY)" placeholder="08/28" error={errors.expiry?.message} {...register('expiry')} />
        <FormField label="CVV" inputMode="numeric" placeholder="123" error={errors.cvv?.message} {...register('cvv')} />
      </div>
      <PayButton processing={processing} />
    </form>
  );
}

interface SavedCardFormProps {
  savedCardId: string;
  onSubmit: (displayLabel: string) => void;
  processing: boolean;
}

export function SavedCardForm({ savedCardId, onSubmit, processing }: SavedCardFormProps) {
  const card = savedCards.find((c) => c.id === savedCardId);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SavedCardCvvFormValues>({ resolver: zodResolver(savedCardCvvSchema) });

  function submit() {
    if (!card) return;
    onSubmit(`${card.brand} •••• ${card.last4}`);
  }

  if (!card) return null;

  return (
    <form onSubmit={(e) => void handleSubmit(submit)(e)} noValidate className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-ink">
        <CreditCard size={16} className="text-fern" />
        {card.brand} •••• {card.last4} <span className="text-ink-soft">expires {card.expiry}</span>
      </div>
      <div className="max-w-[140px]">
        <FormField label="CVV" inputMode="numeric" placeholder="123" error={errors.cvv?.message} {...register('cvv')} />
      </div>
      <PayButton processing={processing} />
    </form>
  );
}

interface SavedCardPickerProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function SavedCardPicker({ selectedId, onSelect }: SavedCardPickerProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {savedCards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onSelect(card.id)}
          className={cn(
            'px-3.5 py-1.5 rounded-full text-sm border transition-colors',
            selectedId === card.id
              ? 'bg-pine text-stone-light border-pine'
              : 'border-stone-dark text-ink-soft hover:border-fern'
          )}
        >
          {card.brand} •••• {card.last4}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          'px-3.5 py-1.5 rounded-full text-sm border transition-colors',
          selectedId === null ? 'bg-pine text-stone-light border-pine' : 'border-stone-dark text-ink-soft hover:border-fern'
        )}
      >
        Use a new card
      </button>
    </div>
  );
}

interface UpiFormProps {
  onSubmit: (displayLabel: string) => void;
  processing: boolean;
}

export function UpiForm({ onSubmit, processing }: UpiFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpiPaymentFormValues>({ resolver: zodResolver(upiPaymentSchema) });

  function submit(values: UpiPaymentFormValues) {
    onSubmit(values.upiId);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(submit)(e)} noValidate className="flex flex-col gap-4">
      <FormField label="UPI ID" placeholder="you@bank" error={errors.upiId?.message} {...register('upiId')} />
      <PayButton processing={processing} />
    </form>
  );
}

interface NetBankingFormProps {
  onSubmit: (displayLabel: string) => void;
  processing: boolean;
}

export function NetBankingForm({ onSubmit, processing }: NetBankingFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NetBankingFormValues>({ resolver: zodResolver(netBankingSchema) });

  function submit(values: NetBankingFormValues) {
    onSubmit(values.bank);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(submit)(e)} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 max-w-xs">
        <label htmlFor="net-banking-bank" className="text-sm font-medium text-ink-soft">
          Bank
        </label>
        <select
          id="net-banking-bank"
          className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm text-ink focus:border-fern transition-colors"
          {...register('bank')}
        >
          <option value="">Select your bank</option>
          {banks.map((bank) => (
            <option key={bank} value={bank}>
              {bank}
            </option>
          ))}
        </select>
        {errors.bank && <p className="text-xs text-rust">{errors.bank.message}</p>}
      </div>
      <PayButton processing={processing} />
    </form>
  );
}
