import { BadRequestException, Injectable } from '@nestjs/common';
import type { PaymentMethodType, PaymentSummary } from './payments.types';

const CARD_LIKE_FAILURE_RATE = 0.15;
const CARD_LIKE_METHODS: PaymentMethodType[] = [
  'CREDIT_CARD',
  'DEBIT_CARD',
  'UPI',
  'NET_BANKING',
];

/**
 * Mirrors apps/web/src/services/paymentService.ts's processPayment
 * exactly, including the ~15% simulated decline rate for card/UPI/net-
 * banking — deliberately, so the payment failure and retry path is
 * reachable on an ordinary checkout run-through, not just a theoretical
 * code path (same reasoning the frontend states for its own version).
 * COD and Wallet don't involve real-time third-party authorization in
 * real systems either, so they always succeed here too.
 *
 * displayLabel is a caller-supplied, already-masked string (e.g. "Visa
 * •••• 4242"), never raw card/account data — matching the frontend's own
 * PaymentForms.tsx, which constructs the masked label client-side and
 * only ever sends that, never a PAN. This mock backend has no more
 * business seeing a real card number than the frontend does; a real
 * payment integration would use a tokenizing SDK client-side for exactly
 * this reason, not send raw card data to your own backend at all.
 */
@Injectable()
export class PaymentsService {
  process(method: PaymentMethodType, displayLabel: string): PaymentSummary {
    const canFail = CARD_LIKE_METHODS.includes(method);
    if (canFail && Math.random() < CARD_LIKE_FAILURE_RATE) {
      throw new BadRequestException(
        'Payment was declined. Check your details and try again, or use a different method.',
      );
    }
    return {
      method,
      displayLabel,
      transactionId: this.generateTransactionId(),
    };
  }

  private generateTransactionId(): string {
    return `txn_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}
