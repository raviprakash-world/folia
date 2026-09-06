import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  Payment,
  PaymentMethodType,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { AppConfigService } from '../config/app-config.service';
import { InventoryService } from '../inventory/inventory.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { PAYMENT_EVENTS } from './payments.events';
import { toPublicOrder } from '../orders/order.types';
import type { CheckoutSnapshot } from '../orders/order.types';
import { ANALYTICS_EVENTS } from '../analytics/analytics.events';

/**
 * How long a gateway payment stays retryable, and how long its stock
 * reservation stays held, before this system gives up on it. The SAME
 * value is deliberately used as the StockReservation TTL for every
 * PAYMENT-referenced reservation (see OrdersService.checkout) — if the two
 * timers ran independently, InventoryService.releaseExpiredReservations
 * (which knows nothing about Payment state) could release a reservation
 * out from under a payment that's still legitimately CREATED, or this
 * sweep and that one could race each other for no reason. With one shared
 * window, releaseExpiredReservations becomes a pure backstop (it still
 * fires independently, e.g. for a payment that went FAILED and was never
 * retried, since that sweep doesn't filter by Payment status at all) and
 * expireStalePayments below is the primary, faster-reacting path for the
 * common "customer abandoned a CREATED payment" case. Deliberately shorter
 * than Razorpay's own ~15-minute order expiry (checkout.js itself won't
 * let a customer pay against a sufficiently stale order) — wait, actually
 * longer: 20 minutes gives real customers room to complete a UPI/net-
 * banking flow without racing their own reservation.
 */
export const PAYMENT_EXPIRY_MINUTES = 20;

const COD_METHOD: PaymentMethodType = 'COD';

export interface CreatePaymentInput {
  paymentId: string;
  userId: string;
  method: PaymentMethodType;
  amount: number;
  displayLabel: string;
  idempotencyKey?: string;
  checkoutSnapshot: CheckoutSnapshot;
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
  /** Only ever set for a payment that resolved synchronously at creation time (COD) — a gateway payment has no order yet, and verify()/the webhook is what eventually produces one. */
  order?: ReturnType<typeof toPublicOrder> | null;
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
 * at all (COD is still a genuine Payment row, never silently marked paid
 * — this project's Phase-1 brief was explicit that COD orders must not be
 * marked "paid").
 *
 * Phase 2 moved Order creation itself into this service
 * (confirmAndCreateOrder), out of OrdersService.checkout: an Order row
 * only ever exists once payment has already resolved (captured, or COD's
 * immediate confirmation), driven by Payment.checkoutSnapshot — the frozen
 * record of everything OrdersService.checkout computed at cart time. See
 * that field's schema.prisma comment and order.types.ts's CheckoutSnapshot
 * for the full reasoning. This is what closes the "order created but
 * payment never resolved" and "inventory decremented but no order exists"
 * gaps Phase 1's decrement-then-create-order-then-pay ordering had no way
 * to fully close.
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
        id: input.paymentId,
        userId: input.userId,
        provider: 'COD',
        method: input.method,
        status: 'COD_PENDING',
        amount: input.amount,
        currency: 'INR',
        displayLabel: input.displayLabel,
        idempotencyKey: input.idempotencyKey ?? null,
        checkoutSnapshot:
          input.checkoutSnapshot as unknown as Prisma.InputJsonValue,
        attempts: {
          create: { status: 'COD_PENDING' },
        },
      },
    });

    // COD has no async confirmation to wait for — the order is
    // fulfillment-ready immediately, so this is the one path where
    // Payment creation and Order creation happen back-to-back in the
    // same request rather than confirmation being a separate later call.
    const order = await this.confirmAndCreateOrder(payment);

    return {
      paymentId: payment.id,
      status: 'COD_PENDING',
      requiresGatewayCheckout: false,
      order,
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
      receipt: input.paymentId,
    });

    const payment = await this.prisma.payment.create({
      data: {
        id: input.paymentId,
        userId: input.userId,
        provider: 'RAZORPAY',
        method: input.method,
        status: 'CREATED',
        amount: input.amount,
        currency: 'INR',
        providerOrderId: gatewayOrder.providerOrderId,
        displayLabel: input.displayLabel,
        idempotencyKey: input.idempotencyKey ?? null,
        checkoutSnapshot:
          input.checkoutSnapshot as unknown as Prisma.InputJsonValue,
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
   * only path that can capture a payment: handleWebhookEvent below does
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
  ): Promise<{ payment: Payment; order: ReturnType<typeof toPublicOrder> }> {
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

    const captured = await this.confirmCapture(
      payment,
      input.providerPaymentId,
    );
    return captured;
  }

  /**
   * Idempotent by construction: re-applying this to an already-CAPTURED
   * payment is a safe no-op that just returns the existing order, since
   * both the client callback (verify) and the webhook can each reach here
   * independently for the same real payment.
   *
   * The CREATED/FAILED → CAPTURED transition itself is an atomic
   * conditional update (`updateMany` with a `status` precondition), not a
   * plain read-then-write — this is what makes it safe against
   * expireStalePayments concurrently racing to expire the very same
   * payment (see that method's doc comment and PAYMENT_EXPIRY_MINUTES's):
   * exactly one of {CAPTURED, EXPIRED} can win for a given payment, never
   * both, because Postgres serializes the two single-row UPDATE
   * statements against each other regardless of which transaction reads
   * first.
   */
  private async confirmCapture(
    payment: Payment,
    providerPaymentId: string,
  ): Promise<{ payment: Payment; order: ReturnType<typeof toPublicOrder> }> {
    if (payment.status === 'CAPTURED') {
      return { payment, order: await this.confirmAndCreateOrder(payment) };
    }

    const { count } = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: { notIn: ['CAPTURED', 'EXPIRED'] } },
      data: { status: 'CAPTURED', providerPaymentId },
    });

    const current = await this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });

    if (count === 0) {
      if (current.status === 'CAPTURED') {
        return {
          payment: current,
          order: await this.confirmAndCreateOrder(current),
        };
      }
      // Lost the race to expireStalePayments: Razorpay says captured, but
      // this system had already given up on the reservation and it may
      // have gone to someone else. Rare by design (the reservation TTL
      // and PAYMENT_EXPIRY_MINUTES share the same window), but a real gap
      // this system surfaces loudly rather than silently creating an
      // order against stock that might no longer be held.
      this.logger.error(
        `Payment ${payment.id} was captured by Razorpay after this system had already marked it ${current.status} — needs manual reconciliation/refund.`,
      );
      throw new BadRequestException(
        'This payment window had already expired when your payment completed. Please contact support — your payment may need to be refunded.',
      );
    }

    await this.recordAttempt(payment.id, 'CAPTURED', { providerPaymentId });

    const order = await this.confirmAndCreateOrder(current);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other controllers/services.
    this.eventEmitter.emit(PAYMENT_EVENTS.CAPTURED, {
      orderId: order.id,
      userId: current.userId,
      paymentId: current.id,
    });
    return { payment: current, order };
  }

  /**
   * The real order-creation step: commits every reservation
   * Payment.checkoutSnapshot recorded and creates the Order row from that
   * frozen snapshot, all inside one transaction alongside setting
   * Payment.orderId — see InventoryService.commitReservation's doc
   * comment for exactly why sharing one transaction (rather than each
   * step committing independently) is what prevents an
   * inventory-decremented-but-order-missing state. Idempotent: if
   * payment.orderId is already set, this payment already produced its
   * order (a prior call, possibly from the other of verify()/webhook, or
   * a retried COD confirmation), and this is a safe no-op that returns
   * the existing order rather than creating a second one.
   *
   * Also the one place ANALYTICS_EVENTS.ORDER_CREATED is emitted (Phase 1
   * emitted it from OrdersController.checkout() instead, unconditionally
   * — wrong once order creation became asynchronous for gateway methods):
   * emitting only on the genuine-creation branch below, never on the
   * idempotent-replay early return above, is what keeps the "Order
   * Placed" notification and analytics log firing exactly once per real
   * order, regardless of whether COD, verify(), or the webhook is what
   * actually produced it.
   */
  private async confirmAndCreateOrder(
    payment: Payment,
  ): Promise<ReturnType<typeof toPublicOrder>> {
    if (payment.orderId) {
      const existing = await this.prisma.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        include: { items: true },
      });
      return toPublicOrder(existing as never);
    }

    const snapshot = payment.checkoutSnapshot as unknown as CheckoutSnapshot;
    if (!snapshot) {
      throw new BadRequestException(
        'This payment has no checkout details recorded and cannot be confirmed.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      for (const line of snapshot.items) {
        await this.inventoryService.commitReservation(line.reservationId, tx);
      }

      const order = await tx.order.create({
        data: {
          id: snapshot.orderId,
          userId: payment.userId,
          subtotal: snapshot.subtotal,
          discount: snapshot.discount,
          couponCode: snapshot.couponCode ?? undefined,
          shippingCost: snapshot.shippingCost,
          tax: snapshot.tax,
          total: snapshot.total,
          shippingAddressSnapshot:
            snapshot.shippingAddressSnapshot as unknown as Prisma.InputJsonValue,
          billingAddressSnapshot:
            snapshot.billingAddressSnapshot as unknown as Prisma.InputJsonValue,
          deliveryMethod: snapshot.deliveryMethod,
          estimatedDelivery: snapshot.estimatedDelivery,
          status: 'PROCESSING',
          paymentMethod: payment.method,
          paymentDisplayLabel: payment.displayLabel ?? payment.method,
          paymentTransactionId: payment.providerPaymentId ?? payment.id,
          customerNotes: snapshot.customerNotes ?? undefined,
          items: {
            create: snapshot.items.map((item) => ({
              productId: item.productId,
              slug: item.slug,
              name: item.name,
              categorySlug: item.categorySlug,
              variantId: item.variantId,
              variantLabel: item.variantLabel,
              price: item.price,
              quantity: item.quantity,
              inventoryItemId: item.inventoryItemId,
            })),
          },
        },
        include: { items: true },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: { orderId: order.id },
      });

      return order;
    });

    await this.clearCartFor(payment.userId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other controllers/services.
    this.eventEmitter.emit(ANALYTICS_EVENTS.ORDER_CREATED, {
      orderId: created.id,
      userId: payment.userId,
      total: Number(created.total),
    });
    return toPublicOrder(created as never);
  }

  private async markFailed(
    payment: Payment,
    errorCode?: string,
    errorDescription?: string,
  ): Promise<void> {
    if (payment.status === 'CAPTURED') return; // never downgrade a real success
    await this.prisma.payment.updateMany({
      where: { id: payment.id, status: { notIn: ['CAPTURED', 'EXPIRED'] } },
      data: { status: 'FAILED' },
    });
    await this.recordAttempt(payment.id, 'FAILED', {
      errorCode,
      errorDescription,
    });
    // The reservation stays held (not released here) — a failed/declined
    // attempt is retryable against the SAME reservation (see retry()
    // below), only an explicit expiry (expireStalePayments) or its
    // TTL backstop (InventoryService.releaseExpiredReservations) frees it.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.eventEmitter.emit(PAYMENT_EVENTS.FAILED, {
      userId: payment.userId,
      paymentId: payment.id,
      errorDescription,
    });
  }

  /**
   * Lets a customer try a fresh Razorpay order after a decline/expiry —
   * keyed by paymentId now (Phase 2), not orderId, since an unconfirmed
   * payment has no order yet to key off of. Payment stays the same row
   * (its checkoutSnapshot/reservations are untouched) rather than creating
   * a second Payment, since "the payment for this checkout attempt" is a
   * single evolving record, and PaymentAttempt already carries the
   * per-try history.
   */
  async retry(paymentId: string, userId: string): Promise<CreatePaymentResult> {
    const payment = await this.findOwnedOrThrow(paymentId, userId);
    if (payment.status === 'CAPTURED') {
      throw new BadRequestException('This order has already been paid for.');
    }
    if (payment.status === 'EXPIRED') {
      throw new BadRequestException(
        'This payment has expired. Please start checkout again.',
      );
    }
    if (payment.provider !== 'RAZORPAY') {
      throw new BadRequestException(
        'Cash on Delivery orders cannot be retried.',
      );
    }

    const gatewayOrder = await this.razorpay.createOrder({
      amount: Number(payment.amount),
      currency: payment.currency,
      receipt: payment.id,
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
   * Closes the gap of a customer who reserved stock at checkout but never
   * completed (or abandoned) payment: without this, a CREATED payment
   * would sit forever and — pre-Phase-2, when checkout decremented real
   * stock up front — that stock would be gone for good. Now (Phase 2)
   * nothing has actually been decremented yet at this point, only
   * reserved, so the fix is simpler: mark the payment EXPIRED and release
   * its reservations back to available stock.
   *
   * The CREATED → EXPIRED transition is an atomic conditional update, not
   * a plain read-then-write, for the same reason confirmCapture's
   * transition is: it's what guarantees this sweep and a
   * verify()/webhook-driven capture can never both "win" for the same
   * payment. `updated === 0` means some concurrent call already moved
   * this payment off CREATED (most likely: it just got captured) — this
   * sweep backs off entirely rather than releasing reservations out from
   * under a payment that turned out to be a real, paid order.
   *
   * Deliberately does NOT touch payments in any other non-terminal status
   * (e.g. FAILED-and-abandoned) — releaseExpiredReservations already
   * covers those via the reservation's own TTL (see
   * PAYMENT_EXPIRY_MINUTES's doc comment for why the two windows are kept
   * equal), which doesn't care what state the Payment is in.
   */
  async expireStalePayments(): Promise<number> {
    const cutoff = new Date(Date.now() - PAYMENT_EXPIRY_MINUTES * 60 * 1000);
    const stale = await this.prisma.payment.findMany({
      where: { status: 'CREATED', createdAt: { lt: cutoff } },
    });

    let count = 0;
    for (const payment of stale) {
      const { count: updated } = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: 'CREATED' },
        data: { status: 'EXPIRED' },
      });
      if (updated === 0) continue; // lost the race to a concurrent capture — leave it alone, it's now a real order

      await this.recordAttempt(payment.id, 'EXPIRED', {
        errorDescription: `No payment completed within ${PAYMENT_EXPIRY_MINUTES} minutes`,
      });

      const snapshot =
        payment.checkoutSnapshot as unknown as CheckoutSnapshot | null;
      if (snapshot) {
        for (const item of snapshot.items) {
          try {
            await this.inventoryService.releaseReservation(item.reservationId);
          } catch (err) {
            // Already released/committed by another path (e.g. the
            // generic reservation-TTL sweep got there first) — a benign
            // race, not a failure, since the end state (reservation no
            // longer holding stock for this payment) is the same either way.
            this.logger.warn(
              `Could not release reservation ${item.reservationId} for expired payment ${payment.id}: ${(err as Error).message}`,
            );
          }
        }
      }
      count++;
    }
    if (count > 0) {
      this.logger.log(`Expired ${count} stale payment(s)`);
    }
    return count;
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
