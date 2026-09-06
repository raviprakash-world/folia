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

const useRealOrdersApi = import.meta.env.VITE_REAL_ORDERS_API === 'true';

/** Real gateway methods only — COD never touches a gateway either way, so it keeps using processPayment's generic "Cash on Delivery" summary regardless of this flag. */
const GATEWAY_METHOD_LABELS: Partial<Record<PaymentMethodType, string>> = {
  'credit-card': 'Card',
  'debit-card': 'Card',
  upi: 'UPI',
  'net-banking': 'Net Banking',
  wallet: 'Wallet',
};

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
    // Real gateway methods (Phase 1): nothing to "process" here at all —
    // Razorpay's own hosted checkout collects the real card/UPI/bank
    // details, and it can't open until a real gateway order exists,
    // which only happens once /checkout is actually called on the
    // Review step. This step's only job for these methods is picking
    // which one, matching the label the eventual Razorpay modal will
    // show. COD has no gateway either way, so it keeps the exact
    // previous behavior (processPayment's generic, always-succeeds
    // summary) regardless of this flag.
    if (useRealOrdersApi && method !== 'cod') {
      // transactionId is a placeholder here, not real (Phase 2: the real
      // one only exists once checkout()'s payment actually resolves,
      // still a step away) — matching PaymentSummary's non-nullable
      // shape (an Order's payment fields are always known by the time an
      // Order itself exists) rather than using null for "not yet known".
      setPayment({ method, displayLabel: GATEWAY_METHOD_LABELS[method] ?? displayLabel, transactionId: '' });
      void navigate('/checkout/review');
      return;
    }

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
      <h1 className="font-display text-2xl font-semibold text-heading mb-1">Payment</h1>
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

      {useRealOrdersApi && method !== 'cod' ? (
        // Real gateway path (Phase 1): no card/UPI/net-banking form here at
        // all — those collect fake, discarded data against the mock
        // backend, and this app has never sent real card/account details
        // to its own backend (see paymentService.ts's own doc comment on
        // why: masked-label-only, matching a real tokenizing-SDK
        // approach). The actual secure entry happens inside Razorpay's own
        // hosted checkout, opened from the Review step once a real
        // gateway order exists. "Wallet" here means a wallet routed
        // through Razorpay (Paytm/PhonePe/etc.), not this mock's internal
        // balance concept, so that check doesn't apply on this path either.
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-ink-soft p-4 rounded-[var(--radius-control)] bg-stone-dark/30">
            <Wallet size={16} className="text-fern" />
            You'll enter your {GATEWAY_METHOD_LABELS[method]?.toLowerCase() ?? 'payment'} details securely on the next
            step.
          </div>
          <Button variant="primary" size="lg" className="self-start" onClick={() => void handlePay('')}>
            Continue to review
          </Button>
        </div>
      ) : (
        <>
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
        </>
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
