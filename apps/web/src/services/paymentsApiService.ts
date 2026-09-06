import { apiClient } from './apiClient';

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
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export async function verifyPayment(paymentId: string, input: VerifyPaymentInput): Promise<{ status: string }> {
  const { data } = await apiClient.post<{ status: string }>(`/payments/${paymentId}/verify`, input);
  return data;
}

export async function retryPayment(orderId: string): Promise<CreatePaymentResult> {
  const { data } = await apiClient.post<CreatePaymentResult>(`/payments/orders/${orderId}/retry`);
  return data;
}

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
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
 */
export async function openRazorpayCheckout(
  gateway: GatewayCheckoutInfo,
  orderDescription: string,
): Promise<VerifyPaymentInput> {
  await loadRazorpayScript();
  if (!window.Razorpay) {
    throw new Error('Could not load the payment provider. Check your connection and try again.');
  }

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
        ondismiss: () => reject(new PaymentCancelledError('Payment was cancelled.')),
      },
    });
    razorpay.open();
  });
}
