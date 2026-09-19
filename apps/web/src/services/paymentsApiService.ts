import { isAxiosError } from 'axios';
import { apiClient } from './apiClient';
import type { Order } from '@/types/order';

export interface GatewayCheckoutInfo {
  keyId: string;
  providerOrderId: string;
  amount: number;
  currency: string;
}

export interface CreatePaymentResult {
  paymentId: string;
  status: string;
  requiresGatewayCheckout: boolean;
  gateway?: GatewayCheckoutInfo;
  /** Only ever set for a payment that resolved synchronously at creation (COD) — a gateway payment has no order yet; verifyPayment's result is what eventually carries one. */
  order?: Order | null;
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

/** Phase 2: an Order is only ever created once payment is confirmed, so this — not checkout() — is where a gateway checkout's real order first exists. */
export interface VerifyPaymentResult {
  payment: { id: string; status: string };
  order: Order;
}

export async function verifyPayment(paymentId: string, input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
  const { data } = await apiClient.post<VerifyPaymentResult>(`/payments/${paymentId}/verify`, input);
  return data;
}

/** Keyed by paymentId (Phase 2), not orderId — an unconfirmed gateway payment has no order yet to key off of. */
export async function retryPayment(paymentId: string): Promise<CreatePaymentResult> {
  const { data } = await apiClient.post<CreatePaymentResult>(`/payments/${paymentId}/retry`);
  return data;
}

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayFailureResponse {
  error: { code?: string; description?: string; reason?: string };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: 'payment.failed', callback: (response: RazorpayFailureResponse) => void) => void;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description?: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}

let scriptLoadPromise: Promise<void> | null = null;

/** Loaded once, reused for every checkout attempt in this session — Razorpay's own script, not vendored, since it's what actually renders their PCI-compliant payment UI (card/UPI/net-banking entry never happens inside this app's own DOM, deliberately, matching this codebase's existing "never collect raw card data ourselves" stance). */
function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  scriptLoadPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_SRC;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment provider. Check your connection and try again.'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export class PaymentCancelledError extends Error {}

/**
 * Opens Razorpay's own hosted checkout modal and resolves with exactly
 * what the backend's verify endpoint needs. Rejects with
 * PaymentCancelledError if the customer closes the modal without paying
 * (a real, expected outcome — distinct from an actual gateway decline,
 * which arrives as a resolved handler call with a payment_id that
 * verify() then rejects) so the caller can show "cancelled, try again"
 * rather than a generic error.
 *
 * Razorpay's `payment.failed` event fires when an attempt is declined but
 * leaves the modal open so the shopper can try another method. It must
 * therefore NOT settle this promise (a later successful attempt in the same
 * modal still has to resolve it). It is reported through `onPaymentFailed`,
 * and remembered so that closing the modal afterwards says why the payment
 * failed instead of just "cancelled".
 */
export async function openRazorpayCheckout(
  gateway: GatewayCheckoutInfo,
  orderDescription: string,
  onPaymentFailed?: (reason: string) => void,
): Promise<VerifyPaymentInput> {
  await loadRazorpayScript();
  if (!window.Razorpay) {
    throw new Error('Could not load the payment provider. Check your connection and try again.');
  }

  let lastFailure: string | null = null;
  return new Promise<VerifyPaymentInput>((resolve, reject) => {
    const razorpay = new window.Razorpay!({
      key: gateway.keyId,
      amount: Math.round(gateway.amount * 100),
      currency: gateway.currency,
      order_id: gateway.providerOrderId,
      name: 'Folia',
      description: orderDescription,
      theme: { color: '#4b7259' }, // Folia's real --color-fern (apps/web/src/index.css), not a guess
      handler: (response) => {
        resolve({
          providerOrderId: response.razorpay_order_id,
          providerPaymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () =>
          reject(new PaymentCancelledError(lastFailure ? `Payment failed: ${lastFailure}` : 'Payment was cancelled.')),
      },
    });
    razorpay.on('payment.failed', (response) => {
      // Read as a sentence in the UI, so make sure it ends like one.
      lastFailure = `${(response.error.description ?? response.error.reason ?? 'the payment was declined').replace(/[.\s]+$/, '')}.`;
      onPaymentFailed?.(lastFailure);
    });
    razorpay.open();
  });
}

/**
 * Plain-language text for anything that goes wrong around a payment. The API
 * already sends shopper-safe messages ("Payment verification failed.", "Not
 * enough stock..."); show those. Never show axios's own wording ("Request
 * failed with status code 400") or a raw network error.
 */
export function paymentErrorMessage(err: unknown, fallback = "We couldn't complete that payment. Please try again."): string {
  if (err instanceof PaymentCancelledError) return err.message;
  if (isAxiosError<{ message?: string | string[] }>(err)) {
    const message = err.response?.data?.message;
    const text = Array.isArray(message) ? message[0] : message;
    return text || fallback;
  }
  if (err instanceof Error && err.message && !/status code|network error|timeout/i.test(err.message)) return err.message;
  return fallback;
}
