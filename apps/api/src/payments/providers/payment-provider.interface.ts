/**
 * What PaymentsService needs from any real gateway — deliberately narrow
 * (create/verify/fetch/refund/verifyWebhook, nothing Razorpay-specific
 * leaks into the type signatures) so a second provider (Stripe, if
 * international cards are ever added) is a new class implementing this
 * interface, not a rewrite of PaymentsService or the checkout flow above
 * it. COD is intentionally NOT modeled behind this interface — it never
 * makes a real gateway round-trip, so forcing it through
 * createOrder/verifySignature would be a fiction; PaymentsService branches
 * on method === 'COD' directly instead.
 */
export interface CreateGatewayOrderInput {
  /** Major currency units (e.g. rupees), matching this codebase's existing Decimal(10,2) convention elsewhere — the provider implementation is responsible for converting to whatever minor-unit format its API requires. */
  amount: number;
  currency: string;
  /** Our own order id — passed through as the gateway's "receipt" field so a support agent can correlate a Razorpay dashboard entry back to a Folia order without a database lookup. */
  receipt: string;
}

export interface GatewayOrder {
  providerOrderId: string;
}

export interface VerifyPaymentSignatureInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface RefundInput {
  providerPaymentId: string;
  /** Major currency units. Omitted entirely for a full refund — the provider implementation refunds the full remaining captured amount in that case. */
  amount?: number;
  reason?: string;
}

export interface RefundResult {
  providerRefundId: string;
}

export interface FetchedPayment {
  providerPaymentId: string;
  status: string;
  amount: number;
  method?: string;
  errorCode?: string;
  errorDescription?: string;
}

export interface PaymentProviderClient {
  createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder>;
  /** HMAC-SHA256(order_id + "|" + payment_id, key_secret) === signature — the synchronous, client-callback-time check. Never sufficient on its own for marking a payment captured; see verifyWebhookSignature and PaymentsService.confirmCapture's doc comment for why the webhook is the authoritative source. */
  verifyPaymentSignature(input: VerifyPaymentSignatureInput): boolean;
  /** Independently confirms what the client-side callback claimed, by asking the gateway directly rather than trusting the callback payload's own amount/status fields — see PaymentsController's doc comment on why this call is not optional. */
  fetchPayment(providerPaymentId: string): Promise<FetchedPayment>;
  refund(input: RefundInput): Promise<RefundResult>;
  /** Verifies the raw webhook body against the given signature header using the webhook secret (distinct from the API key secret used for verifyPaymentSignature) — Razorpay signs webhooks and payment callbacks differently, and mixing the two secrets up is a real, easy-to-make mistake this interface's method split is meant to prevent. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
}
