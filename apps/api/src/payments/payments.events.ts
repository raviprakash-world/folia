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

export interface PaymentFailedPayload {
  orderId: string;
  userId: string;
  paymentId: string;
  errorDescription?: string;
}
