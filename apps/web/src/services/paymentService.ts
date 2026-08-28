import { generateTransactionId } from '@/utils/orderId';
import type { PaymentMethodType, PaymentSummary } from '@/types/order';

const PAYMENT_DELAY_MS = 900;
const CARD_LIKE_FAILURE_RATE = 0.15;

export class PaymentError extends Error {}

interface ProcessPaymentInput {
  method: PaymentMethodType;
  /** Already-masked display value — e.g. "Visa •••• 4242", "you@bank", "Cascade Community Bank". Never a raw card/account number. */
  displayLabel: string;
}

/**
 * Card, UPI, and Net Banking simulate a real-time authorization step that
 * can decline ~15% of the time — deliberately, so the payment failure and
 * retry states are reachable on an ordinary run-through, not just a
 * theoretical code path (same reasoning as the Phase 5 contact form's
 * intentional 10% failure rate). Cash on Delivery and Wallet don't involve
 * real-time third-party authorization in real systems either, so they
 * always succeed here.
 */
export async function processPayment({ method, displayLabel }: ProcessPaymentInput): Promise<PaymentSummary> {
  await new Promise((resolve) => setTimeout(resolve, PAYMENT_DELAY_MS));

  const canFail = method === 'credit-card' || method === 'debit-card' || method === 'upi' || method === 'net-banking';
  if (canFail && Math.random() < CARD_LIKE_FAILURE_RATE) {
    throw new PaymentError('Payment was declined. Check your details and try again, or use a different method.');
  }

  return { method, displayLabel, transactionId: generateTransactionId() };
}
