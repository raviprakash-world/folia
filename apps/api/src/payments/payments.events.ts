/** Same reasoning as notifications/notification.events.ts's own doc comment — plain event names/payloads only, so any module can react without creating a hard dependency on PaymentsModule. */
export const PAYMENT_EVENTS = {
  CAPTURED: 'payment.captured',
  FAILED: 'payment.failed',
  /**
   * Phase 6 — emitted from PaymentsService.refund() itself (the single
   * place a refund can actually happen), not from whatever triggered it
   * (OrdersService.requestCancellation today; a future return-approval
   * flow or direct admin action later) — so every real refund path gets
   * the same notification/email for free, matching PAYMENT_EVENTS.CAPTURED's
   * own reasoning for living in the provider-facing service rather than
   * each caller re-emitting it.
   */
  REFUNDED: 'payment.refunded',
} as const;

export interface PaymentCapturedPayload {
  orderId: string;
  userId: string;
  paymentId: string;
}

/**
 * No orderId (Phase 2): a failed/declined attempt never got as far as
 * creating an Order — confirmAndCreateOrder only ever runs once a payment
 * is actually CAPTURED — so there is no order to reference here.
 */
export interface PaymentFailedPayload {
  userId: string;
  paymentId: string;
  errorDescription?: string;
}

export interface PaymentRefundedPayload {
  /** Null only in the theoretical case a refundable payment never got an order — never actually possible today (confirmAndCreateOrder always sets this before a payment can reach CAPTURED), kept nullable for honesty rather than asserting it. */
  orderId: string | null;
  userId: string;
  paymentId: string;
  amount: number;
}
