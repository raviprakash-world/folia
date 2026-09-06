import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Payment, PaymentMethodType, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { AppConfigService } from '../config/app-config.service';
import { InventoryService } from '../inventory/inventory.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { PAYMENT_EVENTS } from './payments.events';

/**
 * How long a gateway payment stays retryable before this system gives up
 * on it. Deliberately shorter than Razorpay's own ~15-minute order
 * expiry (checkout.js itself won't let a customer pay against a
 * sufficiently stale order) so our own cleanup runs first and is the one
 * that actually cancels the order and restores stock — see
 * expireStalePayments below and jobs/expire-stale-payments.processor.ts,
 * which schedules it.
 */
export const PAYMENT_EXPIRY_MINUTES = 20;

const COD_METHOD: PaymentMethodType = 'COD';

export interface CreatePaymentInput {
  orderId: string;
  userId: string;
  method: PaymentMethodType;
  amount: number;
  displayLabel: string;
}

export interface CreatePaymentResult {
  paymentId: string;
  status: PaymentStatus;
  requiresGatewayCheckout: boolean;
  gateway?: {
    keyId: string;
    providerOrderId: string;
    amount: number;
    currency: string;
  };
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

/**
 * Replaces the old Math.random()-decline simulation entirely — every
 * method below either talks to Razorpay for real (via RazorpayProvider)
 * or, for COD, models a real payment lifecycle with no gateway round-trip
 * at all (see the class-level doc comment on why COD is still a genuine
 * Payment row, never silently marked paid — this project's own Phase-1
 * brief is explicit that COD orders must not be marked "paid").
 *
 * Ownership of Order.status transitions caused by payment outcomes lives
 * here, not in OrdersService — checkout() creates the Order (in
 * PENDING_PAYMENT or PROCESSING, depending on method) and hands off to
 * this service for everything payment-shaped from that point on, the
 * same separation of concerns this codebase already uses elsewhere
 * (OrdersService orchestrates the order lifecycle, InventoryService owns
 * stock, CouponsService owns discount validation).
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly config: AppConfigService,
    private readonly razorpay: RazorpayProvider,
    private readonly inventoryService: InventoryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createForOrder(
    input: CreatePaymentInput,
  ): Promise<CreatePaymentResult> {
    if (input.method === COD_METHOD) {
      return this.createCodPayment(input);
    }
    return this.createGatewayPayment(input);
  }

  private async createCodPayment(
    input: CreatePaymentInput,
  ): Promise<CreatePaymentResult> {
    const payment = await this.prisma.payment.create({
      data: {
        orderId: input.orderId,
        userId: input.userId,
        provider: 'COD',
        method: input.method,
        status: 'COD_PENDING',
        amount: input.amount,
        currency: 'INR',
        displayLabel: input.displayLabel,
        attempts: {
          create: { status: 'COD_PENDING' },
        },
      },
    });

    // COD has no async confirmation to wait for — the order is
    // fulfillment-ready immediately. paymentTransactionId here is our own
    // Payment.id (never a fabricated txn_ string like the old mock),
    // since there is no gateway transaction id for COD to record.
    await this.prisma.order.update({
      where: { id: input.orderId },
      data: {
        status: 'PROCESSING',
        paymentTransactionId: payment.id,
        paymentDisplayLabel: input.displayLabel,
      },
    });
    await this.clearCartFor(input.userId);

    return {
      paymentId: payment.id,
      status: payment.status,
      requiresGatewayCheckout: false,
    };
  }

  private async createGatewayPayment(
    input: CreatePaymentInput,
  ): Promise<CreatePaymentResult> {
    const keyId = this.config.razorpayKeyId;
    if (!keyId) {
      // Fails here, before ever creating a Payment row — a checkout
      // attempt with no Razorpay keys configured should not leave behind
      // a Payment stuck at CREATED with no way to ever resolve it.
      throw new BadRequestException(
        'Card/UPI/net-banking/wallet payments are not available right now. Please choose Cash on Delivery, or try again shortly.',
      );
    }

    const gatewayOrder = await this.razorpay.createOrder({
      amount: input.amount,
      currency: 'INR',
      receipt: input.orderId,
    });

    const payment = await this.prisma.payment.create({
      data: {
        orderId: input.orderId,
        userId: input.userId,
        provider: 'RAZORPAY',
        method: input.method,
        status: 'CREATED',
        amount: input.amount,
        currency: 'INR',
        providerOrderId: gatewayOrder.providerOrderId,
        displayLabel: input.displayLabel,
        attempts: {
          create: { status: 'CREATED' },
        },
      },
    });

    return {
      paymentId: payment.id,
      status: payment.status,
      requiresGatewayCheckout: true,
      gateway: {
        keyId,
        providerOrderId: gatewayOrder.providerOrderId,
        amount: input.amount,
        currency: 'INR',
      },
    };
  }

  /**
   * Called from the frontend's Razorpay Checkout.js success callback —
   * fast, gives the customer an immediate result. Deliberately NOT the
   * only path that can capture a payment: verifyWebhookEvent below does
   * the same underlying confirmCapture and is the authoritative source,
   * since a customer can close the tab after paying but before this
   * callback fires. Both paths converge on the same idempotent
   * confirmCapture, so whichever arrives first wins and the other is a
   * safe no-op.
   */
  async verify(
    paymentId: string,
    userId: string,
    input: VerifyPaymentInput,
  ): Promise<Payment> {
    const payment = await this.findOwnedOrThrow(paymentId, userId);
    if (payment.provider !== 'RAZORPAY') {
      throw new BadRequestException(
        'This payment has no gateway to verify against.',
      );
    }
    if (payment.providerOrderId !== input.providerOrderId) {
      throw new BadRequestException('Payment/order mismatch.');
    }

    const signatureValid = this.razorpay.verifyPaymentSignature({
      providerOrderId: input.providerOrderId,
      providerPaymentId: input.providerPaymentId,
      signature: input.signature,
    });
    if (!signatureValid) {
      await this.recordAttempt(payment.id, 'FAILED', {
        errorDescription: 'Signature verification failed',
      });
      throw new BadRequestException('Payment verification failed.');
    }

    // Never trust the callback's own claim of success — independently
    // ask Razorpay what actually happened to this payment_id. This is
    // the one line standing between "a client that lies about payment
    // status" and this system, per this project's own Phase-1 brief
    // ("never trust frontend payment status/amount").
    const fetched = await this.razorpay.fetchPayment(input.providerPaymentId);
    if (fetched.status !== 'captured') {
      await this.markFailed(
        payment,
        fetched.errorCode,
        fetched.errorDescription,
      );
      throw new BadRequestException(
        fetched.errorDescription ?? 'Payment was not captured.',
      );
    }
    if (Math.abs(fetched.amount - Number(payment.amount)) > 0.01) {
      // A mismatched amount means either a bug or tampering — either way,
      // this is not the payment we asked for and must not be accepted.
      this.logger.error(
        `Payment amount mismatch for ${payment.id}: expected ${payment.amount.toString()}, gateway reports ${fetched.amount}`,
      );
      await this.recordAttempt(payment.id, 'FAILED', {
        errorDescription: 'Amount mismatch',
      });
      throw new BadRequestException('Payment verification failed.');
    }

    return this.confirmCapture(payment, input.providerPaymentId);
  }

  /**
   * Idempotent by construction: re-applying this to an already-CAPTURED
   * payment is a safe no-op, since both the client callback (verify) and
   * the webhook can each reach here independently for the same real
   * payment.
   */
  private async confirmCapture(
    payment: Payment,
    providerPaymentId: string,
  ): Promise<Payment> {
    if (payment.status === 'CAPTURED') return payment;

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CAPTURED', providerPaymentId },
    });
    await this.recordAttempt(payment.id, 'CAPTURED', { providerPaymentId });
    await this.prisma.order.update({
      where: { id: payment.orderId },
      data: {
        status: 'PROCESSING',
        paymentTransactionId: providerPaymentId,
        paymentDisplayLabel: payment.displayLabel,
      },
    });
    await this.clearCartFor(payment.userId);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other controllers/services.
    this.eventEmitter.emit(PAYMENT_EVENTS.CAPTURED, {
      orderId: payment.orderId,
      userId: payment.userId,
      paymentId: payment.id,
    });
    return updated;
  }

  private async markFailed(
    payment: Payment,
    errorCode?: string,
    errorDescription?: string,
  ): Promise<void> {
    if (payment.status === 'CAPTURED') return; // never downgrade a real success
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });
    await this.recordAttempt(payment.id, 'FAILED', {
      errorCode,
      errorDescription,
    });
    // Order deliberately stays in PENDING_PAYMENT, not moved to
    // CANCELLED — a failed attempt is retryable (see retry() below); only
    // an explicit cancellation or the expiry sweep ends the order.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(PAYMENT_EVENTS.FAILED, {
      orderId: payment.orderId,
      userId: payment.userId,
      paymentId: payment.id,
      errorDescription,
    });
  }

  /**
   * Lets a customer try a fresh Razorpay order against the same Folia
   * order after a decline/expiry — Payment stays the same row (1:1 with
   * Order) rather than creating a second Payment, since "the payment for
   * this order" is a single evolving record, and PaymentAttempt already
   * carries the per-try history.
   */
  async retry(orderId: string, userId: string): Promise<CreatePaymentResult> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });
    if (!payment || payment.userId !== userId) {
      throw new NotFoundException('Payment not found.');
    }
    if (payment.status === 'CAPTURED') {
      throw new BadRequestException('This order has already been paid for.');
    }
    if (payment.provider !== 'RAZORPAY') {
      throw new BadRequestException(
        'Cash on Delivery orders cannot be retried.',
      );
    }

    const gatewayOrder = await this.razorpay.createOrder({
      amount: Number(payment.amount),
      currency: payment.currency,
      receipt: orderId,
    });
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'CREATED',
        providerOrderId: gatewayOrder.providerOrderId,
      },
    });
    await this.recordAttempt(payment.id, 'CREATED');

    const keyId = this.config.razorpayKeyId;
    if (!keyId) {
      throw new BadRequestException('Payments are not available right now.');
    }
    return {
      paymentId: payment.id,
      status: 'CREATED',
      requiresGatewayCheckout: true,
      gateway: {
        keyId,
        providerOrderId: gatewayOrder.providerOrderId,
        amount: Number(payment.amount),
        currency: payment.currency,
      },
    };
  }

  /**
   * Not wired to any automatic trigger yet — Phase 6 (returns/refunds)
   * connects cancellation/return approval to this. Built and independently
   * callable now (admin-invoked) so the gateway-facing half of a refund
   * is real and tested before anything upstream depends on it.
   */
  async refund(
    paymentId: string,
    input: { amount?: number; reason?: string },
  ): Promise<{ id: string; status: string; providerRefundId: string }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    if (
      payment.status !== 'CAPTURED' &&
      payment.status !== 'PARTIALLY_REFUNDED'
    ) {
      throw new BadRequestException('Only a captured payment can be refunded.');
    }
    if (!payment.providerPaymentId) {
      throw new BadRequestException(
        'This payment has no gateway transaction to refund.',
      );
    }

    const result = await this.razorpay.refund({
      providerPaymentId: payment.providerPaymentId,
      amount: input.amount,
      reason: input.reason,
    });

    const refund = await this.prisma.refund.create({
      data: {
        paymentId: payment.id,
        amount: input.amount ?? payment.amount,
        status: 'PROCESSED',
        providerRefundId: result.providerRefundId,
        reason: input.reason,
      },
    });

    const isFullRefund =
      input.amount === undefined || input.amount >= Number(payment.amount);
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED' },
    });

    return {
      id: refund.id,
      status: refund.status,
      providerRefundId: result.providerRefundId,
    };
  }

  /**
   * The authoritative confirmation path — see verify()'s doc comment for
   * why the client callback alone is never sufficient. providerEventId's
   * database-level uniqueness (not an in-memory Set, which wouldn't be
   * shared across multiple server instances) is what makes a redelivered
   * webhook a genuine no-op rather than double-processing.
   */
  async handleWebhookEvent(
    rawBody: string,
    signature: string,
    providerEventId: string,
  ): Promise<{ status: string }> {
    if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature.');
    }

    let parsed: {
      event: string;
      payload?: { payment?: { entity?: Record<string, unknown> } };
    };
    try {
      parsed = JSON.parse(rawBody) as typeof parsed;
    } catch {
      throw new BadRequestException('Malformed webhook payload.');
    }

    try {
      await this.prisma.paymentWebhookEvent.create({
        data: {
          provider: 'RAZORPAY',
          providerEventId,
          eventType: parsed.event,
          payload: JSON.parse(rawBody) as object,
        },
      });
    } catch {
      // Unique constraint violation on providerEventId — Razorpay
      // redelivered an event we've already recorded. Returning success
      // here (rather than an error) is deliberate: Razorpay retries on
      // any non-2xx response, and a duplicate is not a failure, it's
      // exactly the case this whole method exists to handle safely.
      this.logger.log(`Duplicate webhook event ignored: ${providerEventId}`);
      return { status: 'duplicate' };
    }

    const entity = parsed.payload?.payment?.entity;
    const orderId = entity?.order_id as string | undefined;
    const providerPaymentId = entity?.id as string | undefined;

    if (orderId && providerPaymentId) {
      const payment = await this.prisma.payment.findFirst({
        where: { providerOrderId: orderId },
      });
      if (payment) {
        if (parsed.event === 'payment.captured') {
          await this.confirmCapture(payment, providerPaymentId);
        } else if (parsed.event === 'payment.failed') {
          await this.markFailed(
            payment,
            entity?.error_code as string | undefined,
            entity?.error_description as string | undefined,
          );
        }
      }
    }

    await this.prisma.paymentWebhookEvent.update({
      where: { providerEventId },
      data: { processedAt: new Date() },
    });
    return { status: 'processed' };
  }

  /**
   * Closes the real gap Phase 1 introduced by making payment
   * asynchronous: an order that decremented real stock at checkout but
   * whose customer never completed (or abandoned) payment would
   * otherwise sit in PENDING_PAYMENT forever, with that stock gone for
   * good. Scheduled by jobs/expire-stale-payments.processor.ts, same
   * pattern as the existing release-expired-reservations job. Restoring
   * stock to the exact InventoryItem each line was decremented from
   * (via OrderItem.inventoryItemId — see InventoryService.decrementForProduct's
   * doc comment) rather than "a" matching item is what makes this
   * correct across multiple warehouses, not just approximately right.
   *
   * Deliberately narrow in scope for Phase 1: this is a safety-net sweep
   * for the current one-decrement-per-line checkout path, not the real
   * fix — Phase 2 (inventory concurrency + atomic checkout) replaces the
   * decrement-then-hope-it-pays-off pattern with reserve-before-pay
   * entirely, at which point stale reservations already expire via the
   * existing release-expired-reservations job and this method's job
   * shrinks to just marking Payment/Order state, no stock math.
   */
  async expireStalePayments(): Promise<number> {
    const cutoff = new Date(Date.now() - PAYMENT_EXPIRY_MINUTES * 60 * 1000);
    const stale = await this.prisma.payment.findMany({
      where: { status: 'CREATED', createdAt: { lt: cutoff } },
      include: { order: { include: { items: true } } },
    });

    let count = 0;
    for (const payment of stale) {
      if (payment.order.status !== 'PENDING_PAYMENT') continue; // already resolved by a race with verify()/webhook — leave it alone

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'EXPIRED' },
      });
      await this.recordAttempt(payment.id, 'EXPIRED', {
        errorDescription: `No payment completed within ${PAYMENT_EXPIRY_MINUTES} minutes`,
      });
      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { status: 'CANCELLED' },
      });
      for (const item of payment.order.items) {
        if (item.inventoryItemId) {
          await this.inventoryService.restoreQuantity(
            item.inventoryItemId,
            item.quantity,
          );
        }
      }
      count++;
    }
    if (count > 0) {
      this.logger.log(`Expired ${count} stale pending-payment order(s)`);
    }
    return count;
  }

  /**
   * Closes out a Payment whose order was cancelled before payment ever
   * completed (OrdersService.requestCancellation, PENDING_PAYMENT case) —
   * same terminal state as expireStalePayments, different trigger
   * (explicit customer action vs. a timeout sweep). A no-op if the
   * payment already resolved (CAPTURED) by the time this runs, since a
   * captured payment can no longer be "never paid for."
   */
  async cancelForOrder(orderId: string): Promise<void> {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
    });
    if (!payment || payment.status === 'CAPTURED') return;
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'EXPIRED' },
    });
    await this.recordAttempt(payment.id, 'EXPIRED', {
      errorDescription: 'Order cancelled before payment completed',
    });
  }

  async findOwnedOrThrow(paymentId: string, userId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    if (payment.userId !== userId) {
      throw new ForbiddenException('This payment does not belong to you.');
    }
    return payment;
  }

  private async recordAttempt(
    paymentId: string,
    status: PaymentStatus,
    extra: {
      providerPaymentId?: string;
      errorCode?: string;
      errorDescription?: string;
    } = {},
  ): Promise<void> {
    await this.prisma.paymentAttempt.create({
      data: { paymentId, status, ...extra },
    });
  }

  private async clearCartFor(userId: string): Promise<void> {
    const { cart } = await this.cartService.resolveCart(userId, null);
    await this.cartService.clearCart(cart.id);
  }
}
