import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, Banknote, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { paymentMethodDefs, walletBalance } from '@/data/paymentMethods';
import { processPayment, PaymentError } from '@/services/paymentService';
import { useCheckoutStore } from '@/store/checkoutStore';
import { useCartTotals } from '@/hooks/useCart';
import { formatCurrency } from '@/utils/currency';
import { cn } from '@/utils/cn';
import { NewCardForm, SavedCardForm, SavedCardPicker, UpiForm, NetBankingForm } from '@/components/checkout/PaymentForms';
import type { PaymentMethodType } from '@/types/order';

export default function CheckoutPayment() {
  const navigate = useNavigate();
  const setPayment = useCheckoutStore((s) => s.setPayment);
  const deliveryMethod = useCheckoutStore((s) => s.deliveryMethod);
  const { total } = useCartTotals();

  const [method, setMethod] = useState<PaymentMethodType>('credit-card');
  const [savedCardId, setSavedCardId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!deliveryMethod) {
    return (
      <Alert tone="error">
        No delivery method selected.{' '}
        <button type="button" onClick={() => void navigate('/checkout/delivery')} className="underline">
          Go back
        </button>
        .
      </Alert>
    );
  }

  async function handlePay(displayLabel: string) {
    setProcessing(true);
    setError(null);
    try {
      const payment = await processPayment({ method, displayLabel });
      setPayment(payment);
      void navigate('/checkout/review');
    } catch (err) {
      setError(err instanceof PaymentError ? err.message : 'Something went wrong processing payment.');
    } finally {
      setProcessing(false);
    }
  }

  const walletSufficient = walletBalance >= total;

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-pine mb-1">Payment</h1>
      <p className="text-sm text-ink-soft mb-6">Total due: {formatCurrency(total)}</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {paymentMethodDefs.map((def) => (
          <button
            key={def.id}
            type="button"
            onClick={() => {
              setMethod(def.id);
              setError(null);
            }}
            aria-pressed={method === def.id}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-sm border transition-colors',
              method === def.id ? 'bg-pine text-stone-light border-pine' : 'border-stone-dark text-ink-soft hover:border-fern'
            )}
          >
            {def.label}
          </button>
        ))}
      </div>

      {error && (
        <Alert tone="error" className="mb-5">
          <span className="flex items-center gap-1.5">
            <RotateCcw size={14} />
            {error} You can retry below.
          </span>
        </Alert>
      )}

      {(method === 'credit-card' || method === 'debit-card') && (
        <>
          <SavedCardPicker selectedId={savedCardId} onSelect={setSavedCardId} />
          {savedCardId ? (
            <SavedCardForm savedCardId={savedCardId} onSubmit={(label) => void handlePay(label)} processing={processing} />
          ) : (
            <NewCardForm onSubmit={(label) => void handlePay(label)} processing={processing} />
          )}
        </>
      )}

      {method === 'upi' && <UpiForm onSubmit={(label) => void handlePay(label)} processing={processing} />}

      {method === 'net-banking' && <NetBankingForm onSubmit={(label) => void handlePay(label)} processing={processing} />}

      {method === 'wallet' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-ink p-4 rounded-[var(--radius-control)] bg-stone-dark/30">
            <Wallet size={16} className="text-fern" />
            Wallet balance: <span className="font-mono">{formatCurrency(walletBalance)}</span>
          </div>
          {!walletSufficient && (
            <Alert tone="error">Your wallet balance isn't enough to cover this order. Choose another method.</Alert>
          )}
          <Button
            variant="primary"
            size="lg"
            disabled={processing || !walletSufficient}
            className="self-start"
            onClick={() => void handlePay(`Wallet (${formatCurrency(walletBalance)} balance)`)}
          >
            {processing ? 'Processing…' : `Pay ${formatCurrency(total)} with wallet`}
          </Button>
        </div>
      )}

      {method === 'cod' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-ink-soft p-4 rounded-[var(--radius-control)] bg-stone-dark/30">
            <Banknote size={16} className="text-fern" />
            Pay with cash when your order arrives.
          </div>
          <Button
            variant="primary"
            size="lg"
            disabled={processing}
            className="self-start"
            onClick={() => void handlePay('Cash on Delivery')}
          >
            {processing ? 'Confirming…' : 'Confirm order'}
          </Button>
        </div>
      )}

      <div className="flex justify-start pt-8 mt-4 border-t border-stone-dark">
        <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => void navigate('/checkout/delivery')}>
          Back
        </Button>
      </div>
    </div>
  );
}
