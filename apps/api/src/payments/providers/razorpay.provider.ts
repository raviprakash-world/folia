import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import Razorpay from 'razorpay';
import { AppConfigService } from '../../config/app-config.service';
import type {
  CreateGatewayOrderInput,
  FetchedPayment,
  GatewayOrder,
  PaymentProviderClient,
  RefundInput,
  RefundResult,
  VerifyPaymentSignatureInput,
} from './payment-provider.interface';

/**
 * The one real gateway integration in this codebase (see
 * docs/API_INTEGRATION_STATUS.md). Amounts everywhere else in this
 * project are major currency units (rupees, Decimal(10,2)) — Razorpay's
 * API works in minor units (paise) exclusively, so every amount crossing
 * this boundary is multiplied/divided by 100 right here, once, rather
 * than leaking paise-vs-rupee conversion into PaymentsService or
 * anywhere else that has to stay consistent with the rest of the app's
 * Decimal convention.
 *
 * The Razorpay client is constructed lazily (on first real use, not in
 * the constructor) specifically so this provider can be instantiated —
 * and the app can boot — with no RAZORPAY_KEY_ID/SECRET configured at
 * all (a fresh checkout, CI, local dev before real test keys exist). It
 * fails loudly and specifically the moment a real gateway call is
 * actually attempted, matching this codebase's existing pattern for the
 * still-missing email provider (see auth.service.ts).
 */
@Injectable()
export class RazorpayProvider implements PaymentProviderClient {
  private readonly logger = new Logger(RazorpayProvider.name);
  private client: Razorpay | null = null;

  constructor(private readonly config: AppConfigService) {}

  private getClient(): Razorpay {
    if (this.client) return this.client;

    const keyId = this.config.razorpayKeyId;
    const keySecret = this.config.razorpayKeySecret;
    if (!keyId || !keySecret) {
      throw new InternalServerErrorException(
        'Razorpay is not configured — RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET are unset. Real payments cannot be processed until a Razorpay account exists and its keys are set (see docs/API_INTEGRATION_STATUS.md).',
      );
    }
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    return this.client;
  }

  async createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder> {
    const client = this.getClient();
    try {
      const order = await client.orders.create({
        amount: Math.round(input.amount * 100),
        currency: input.currency,
        receipt: input.receipt,
      });
      return { providerOrderId: order.id };
    } catch (err) {
      return this.failGatewayCall('order creation', err);
    }
  }

  /**
   * The Razorpay SDK rejects with a plain object ({ statusCode, error: { code,
   * description } }), not an Error, which would surface as an opaque 500 with
   * nothing in the logs. Log what Razorpay actually said (never the keys) and
   * answer with a 500 the shopper can act on.
   *
   * A rejected key (Razorpay 401) is deliberately NOT returned as a 401: to
   * this API's clients a 401 means "your login expired", and the web app
   * reacts by trying to refresh the session and signing the shopper out.
   * Bad gateway credentials are our problem, not theirs.
   */
  private failGatewayCall(action: string, err: unknown): never {
    const e = err as {
      statusCode?: number;
      error?: { code?: string; description?: string };
    };
    if (e?.statusCode === 401) {
      this.logger.error(
        `Razorpay rejected our API credentials during ${action} (401). Check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET and that they are a matching test or live pair.`,
      );
    } else {
      this.logger.error(
        `Razorpay ${action} failed: status=${e?.statusCode ?? 'n/a'} code=${e?.error?.code ?? 'n/a'} description=${e?.error?.description ?? (err instanceof Error ? err.message : 'unknown')}`,
      );
    }
    throw new InternalServerErrorException(
      'Payments are temporarily unavailable. Please try again shortly, or choose Cash on Delivery.',
    );
  }

  verifyPaymentSignature(input: VerifyPaymentSignatureInput): boolean {
    const keySecret = this.config.razorpayKeySecret;
    if (!keySecret) {
      throw new InternalServerErrorException(
        'Razorpay is not configured — RAZORPAY_KEY_SECRET is unset.',
      );
    }
    // Razorpay's own helper, not a hand-rolled HMAC — see
    // node_modules/razorpay/dist/utils/razorpay-utils.d.ts. Deliberately
    // using the SDK's tested implementation rather than reimplementing
    // HMAC-SHA256(order_id + "|" + payment_id) by hand, which is the
    // exact kind of subtly-wrong crypto code a security review would
    // (rightly) flag.
    return Razorpay.validateWebhookSignature(
      `${input.providerOrderId}|${input.providerPaymentId}`,
      input.signature,
      keySecret,
    );
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const webhookSecret = this.config.razorpayWebhookSecret;
    if (!webhookSecret) {
      throw new InternalServerErrorException(
        'Razorpay is not configured — RAZORPAY_WEBHOOK_SECRET is unset.',
      );
    }
    return Razorpay.validateWebhookSignature(rawBody, signature, webhookSecret);
  }

  async fetchPayment(providerPaymentId: string): Promise<FetchedPayment> {
    const payment = await this.getClient().payments.fetch(providerPaymentId);
    return {
      providerPaymentId: payment.id,
      status: payment.status,
      amount: Number(payment.amount) / 100,
      method: payment.method,
      errorCode: payment.error_code ?? undefined,
      errorDescription: payment.error_description ?? undefined,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const refund = await this.getClient().payments.refund(
      input.providerPaymentId,
      {
        ...(input.amount !== undefined
          ? { amount: Math.round(input.amount * 100) }
          : {}),
        ...(input.reason ? { notes: { reason: input.reason } } : {}),
      },
    );
    return { providerRefundId: refund.id };
  }
}
