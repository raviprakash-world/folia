/** Same reasoning as notifications/notification.events.ts's own doc comment — plain event names/payloads only, so any module can react without creating a hard dependency on PaymentsModule. */
export const PAYMENT_EVENTS = {
  CAPTURED: 'payment.captured',
  FAILED: 'payment.failed',
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
