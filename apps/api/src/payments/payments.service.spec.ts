/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// Same reasoning as auth.service.spec.ts's top-of-file comment.
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService, PAYMENT_EXPIRY_MINUTES } from './payments.service';
import type { CheckoutSnapshot } from '../orders/order.types';

function decimal(value: number) {
  return value; // Prisma Decimal in these mocks is just a plain number — Number(payment.amount) works either way, matching this codebase's existing decimal() test-helper convention elsewhere.
}

function makeSnapshot(
  overrides: Partial<CheckoutSnapshot> = {},
): CheckoutSnapshot {
  return {
    orderId: 'FOL-1',
    subtotal: 65,
    discount: 0,
    couponCode: null,
    shippingCost: 6.5,
    tax: 5.2,
    total: 71.3,
    estimatedDelivery: '3–5 business days',
    deliveryMethod: 'STANDARD',
    customerNotes: null,
    shippingAddressSnapshot: { id: 'addr-1' } as never,
    billingAddressSnapshot: { id: 'addr-1' } as never,
    items: [
      {
        productId: 'prod-1',
        slug: 'monstera',
        name: 'Monstera',
        categorySlug: 'plants',
        variantId: null,
        variantLabel: null,
        price: 65,
        quantity: 1,
        inventoryItemId: 'inv-1',
        reservationId: 'res-1',
      },
    ],
    ...overrides,
  };
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    orderId: null, // Phase 2: no order until confirmAndCreateOrder runs
    userId: 'user-1',
    provider: 'RAZORPAY',
    method: 'CREDIT_CARD',
    status: 'CREATED',
    amount: decimal(71.3),
    currency: 'INR',
    providerOrderId: 'order_razorpay_1',
    providerPaymentId: null,
    displayLabel: 'Visa •••• 4242',
    checkoutSnapshot: makeSnapshot(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Shape `tx.order.create`/`prisma.order.findUniqueOrThrow` return — Prisma Decimal fields need `.toNumber()`, matching order.types.ts's OrderRecord. */
function makeOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'FOL-1',
    createdAt: new Date(),
    status: 'PROCESSING',
    items: [],
    subtotal: { toNumber: () => 65 },
    discount: { toNumber: () => 0 },
    couponCode: null,
    shippingCost: { toNumber: () => 6.5 },
    tax: { toNumber: () => 5.2 },
    total: { toNumber: () => 71.3 },
    shippingAddressSnapshot: { id: 'addr-1' },
    billingAddressSnapshot: { id: 'addr-1' },
    deliveryMethod: 'STANDARD',
    estimatedDelivery: '3–5 business days',
    paymentMethod: 'CREDIT_CARD',
    paymentDisplayLabel: 'Visa •••• 4242',
    paymentTransactionId: 'pay_abc',
    courierId: 'SWIFTPOST',
    trackingNumber: 'SW123456789',
    customerNotes: null,
    ...overrides,
  };
}

function createDeps() {
  const orderTx = {
    order: { create: jest.fn().mockResolvedValue(makeOrderRow()) },
    payment: { update: jest.fn() },
  };
  const prisma = {
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    paymentAttempt: { create: jest.fn() },
    refund: { create: jest.fn() },
    paymentWebhookEvent: { create: jest.fn(), update: jest.fn() },
    order: { findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn((cb: (tx: typeof orderTx) => unknown) => cb(orderTx)),
  };
  const cartService = {
    resolveCart: jest
      .fn()
      .mockResolvedValue({ cart: { id: 'cart-1', items: [] } }),
    clearCart: jest.fn(),
  };
  const config = {
    razorpayKeyId: 'rzp_test_key',
    razorpayKeySecret: 'test_secret',
    razorpayWebhookSecret: 'webhook_secret',
  };
  const razorpay = {
    createOrder: jest.fn(),
    verifyPaymentSignature: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    fetchPayment: jest.fn(),
    refund: jest.fn(),
  };
  const inventoryService = {
    commitReservation: jest.fn(),
    releaseReservation: jest.fn(),
  };
  const eventEmitter = { emit: jest.fn() };

  const service = new PaymentsService(
    prisma as never,
    cartService as never,
    config as never,
    razorpay as never,
    inventoryService as never,
    eventEmitter,
  );

  return {
    prisma,
    orderTx,
    cartService,
    config,
    razorpay,
    inventoryService,
    eventEmitter,
    service,
  };
}

describe('PaymentsService.createForOrder — COD', () => {
  it('creates a COD_PENDING payment with no gateway round-trip and no requiresGatewayCheckout', async () => {
    const { prisma, razorpay, service } = createDeps();
    prisma.payment.create.mockResolvedValue(
      makePayment({ provider: 'COD', status: 'COD_PENDING', method: 'COD' }),
    );

    const result = await service.createForOrder({
      paymentId: 'pay-1',
      userId: 'user-1',
      method: 'COD',
      amount: 71.3,
      displayLabel: 'Pay on delivery',
      checkoutSnapshot: makeSnapshot(),
    });

    expect(result.requiresGatewayCheckout).toBe(false);
    expect(razorpay.createOrder).not.toHaveBeenCalled();
  });

  it('resolves synchronously into a real order — COD has nothing async to wait for, so confirmAndCreateOrder runs immediately', async () => {
    const { prisma, orderTx, inventoryService, service } = createDeps();
    const snapshot = makeSnapshot();
    prisma.payment.create.mockResolvedValue(
      makePayment({
        id: 'pay-cod-1',
        provider: 'COD',
        method: 'COD',
        status: 'COD_PENDING',
        checkoutSnapshot: snapshot,
      }),
    );
    orderTx.order.create.mockResolvedValue(
      makeOrderRow({ id: snapshot.orderId }),
    );

    const result = await service.createForOrder({
      paymentId: 'pay-cod-1',
      userId: 'user-1',
      method: 'COD',
      amount: 71.3,
      displayLabel: 'Pay on delivery',
      checkoutSnapshot: snapshot,
    });

    expect(inventoryService.commitReservation).toHaveBeenCalledWith(
      'res-1',
      orderTx,
    );
    expect(orderTx.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-cod-1' },
      data: { orderId: snapshot.orderId },
    });
    expect(result.order?.id).toBe(snapshot.orderId);
  });

  it('clears the cart once the order is created for COD, since there is nothing asynchronous to wait for', async () => {
    const { prisma, cartService, service } = createDeps();
    prisma.payment.create.mockResolvedValue(makePayment({ provider: 'COD' }));

    await service.createForOrder({
      paymentId: 'pay-1',
      userId: 'user-1',
      method: 'COD',
      amount: 71.3,
      displayLabel: 'Pay on delivery',
      checkoutSnapshot: makeSnapshot(),
    });

    expect(cartService.clearCart).toHaveBeenCalledWith('cart-1');
  });
});

describe('PaymentsService.createForOrder — Razorpay', () => {
  it('creates a real gateway order and returns everything the frontend needs to open Checkout.js', async () => {
    const { prisma, razorpay, service } = createDeps();
    razorpay.createOrder.mockResolvedValue({ providerOrderId: 'order_abc' });
    prisma.payment.create.mockResolvedValue(
      makePayment({ providerOrderId: 'order_abc' }),
    );

    const result = await service.createForOrder({
      paymentId: 'pay-1',
      userId: 'user-1',
      method: 'CREDIT_CARD',
      amount: 71.3,
      displayLabel: 'Visa •••• 4242',
      checkoutSnapshot: makeSnapshot(),
    });

    expect(razorpay.createOrder).toHaveBeenCalledWith({
      amount: 71.3,
      currency: 'INR',
      receipt: 'pay-1',
    });
    expect(result.requiresGatewayCheckout).toBe(true);
    expect(result.gateway).toEqual({
      keyId: 'rzp_test_key',
      providerOrderId: 'order_abc',
      amount: 71.3,
      currency: 'INR',
    });
  });

  it('does NOT create an order, commit any reservation, or clear the cart yet — nothing is confirmed until verify()/the webhook resolves it', async () => {
    const { prisma, cartService, razorpay, inventoryService, service } =
      createDeps();
    razorpay.createOrder.mockResolvedValue({ providerOrderId: 'order_abc' });
    prisma.payment.create.mockResolvedValue(makePayment());

    await service.createForOrder({
      paymentId: 'pay-1',
      userId: 'user-1',
      method: 'UPI',
      amount: 71.3,
      displayLabel: 'you@bank',
      checkoutSnapshot: makeSnapshot(),
    });

    expect(inventoryService.commitReservation).not.toHaveBeenCalled();
    expect(cartService.clearCart).not.toHaveBeenCalled();
  });

  it('persists the checkout snapshot and idempotency key on the Payment row', async () => {
    const { prisma, razorpay, service } = createDeps();
    razorpay.createOrder.mockResolvedValue({ providerOrderId: 'order_abc' });
    prisma.payment.create.mockResolvedValue(makePayment());
    const snapshot = makeSnapshot();

    await service.createForOrder({
      paymentId: 'pay-1',
      userId: 'user-1',
      method: 'CREDIT_CARD',
      amount: 71.3,
      displayLabel: 'Visa •••• 4242',
      idempotencyKey: 'idem-key-1',
      checkoutSnapshot: snapshot,
    });

    const createCall = prisma.payment.create.mock.calls[0][0] as {
      data: { idempotencyKey: string; checkoutSnapshot: unknown };
    };
    expect(createCall.data.idempotencyKey).toBe('idem-key-1');
    expect(createCall.data.checkoutSnapshot).toEqual(snapshot);
  });

  it('rejects up front, before ever creating a Payment row, when Razorpay is not configured at all', async () => {
    const { config, prisma, razorpay, service } = createDeps();
    config.razorpayKeyId = undefined as never;

    await expect(
      service.createForOrder({
        paymentId: 'pay-1',
        userId: 'user-1',
        method: 'CREDIT_CARD',
        amount: 71.3,
        displayLabel: 'Visa •••• 4242',
        checkoutSnapshot: makeSnapshot(),
      }),
    ).rejects.toThrow(BadRequestException);
    expect(razorpay.createOrder).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('propagates a gateway failure (e.g. a timeout) rather than silently creating a Payment with no real gateway order behind it', async () => {
    const { prisma, razorpay, service } = createDeps();
    razorpay.createOrder.mockRejectedValue(new Error('ETIMEDOUT'));

    await expect(
      service.createForOrder({
        paymentId: 'pay-1',
        userId: 'user-1',
        method: 'CREDIT_CARD',
        amount: 71.3,
        displayLabel: 'Visa •••• 4242',
        checkoutSnapshot: makeSnapshot(),
      }),
    ).rejects.toThrow('ETIMEDOUT');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.verify', () => {
  it('rejects when the payment does not belong to the caller', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ userId: 'someone-else' }),
    );

    await expect(
      service.verify('pay-1', 'user-1', {
        providerOrderId: 'order_abc',
        providerPaymentId: 'pay_abc',
        signature: 'sig',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a provider order id that does not match this payment — a real order/payment mismatch, not just a bad signature', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ providerOrderId: 'order_real' }),
    );

    await expect(
      service.verify('pay-1', 'user-1', {
        providerOrderId: 'order_wrong',
        providerPaymentId: 'pay_abc',
        signature: 'sig',
      }),
    ).rejects.toThrow('Payment/order mismatch.');
  });

  it('rejects an invalid signature without ever calling fetchPayment (no reason to trust Razorpay for details on an unverified claim)', async () => {
    const { prisma, razorpay, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(makePayment());
    razorpay.verifyPaymentSignature.mockReturnValue(false);

    await expect(
      service.verify('pay-1', 'user-1', {
        providerOrderId: 'order_razorpay_1',
        providerPaymentId: 'pay_abc',
        signature: 'bad-sig',
      }),
    ).rejects.toThrow('Payment verification failed.');
    expect(razorpay.fetchPayment).not.toHaveBeenCalled();
  });

  it("never trusts the callback's own claim — independently re-fetches the payment from Razorpay and rejects if the gateway itself does not report it captured", async () => {
    const { prisma, razorpay, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(makePayment());
    razorpay.verifyPaymentSignature.mockReturnValue(true);
    razorpay.fetchPayment.mockResolvedValue({
      providerPaymentId: 'pay_abc',
      status: 'failed',
      amount: 71.3,
      errorDescription: 'Card declined',
    });

    await expect(
      service.verify('pay-1', 'user-1', {
        providerOrderId: 'order_razorpay_1',
        providerPaymentId: 'pay_abc',
        signature: 'sig',
      }),
    ).rejects.toThrow('Card declined');
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'FAILED' } }),
    );
  });

  it('rejects on an amount mismatch between what we expected and what the gateway actually reports — a real tamper/bug signal', async () => {
    const { prisma, razorpay, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ amount: decimal(71.3) }),
    );
    razorpay.verifyPaymentSignature.mockReturnValue(true);
    razorpay.fetchPayment.mockResolvedValue({
      providerPaymentId: 'pay_abc',
      status: 'captured',
      amount: 1.0, // wildly different from the 71.3 this payment was created for
    });

    await expect(
      service.verify('pay-1', 'user-1', {
        providerOrderId: 'order_razorpay_1',
        providerPaymentId: 'pay_abc',
        signature: 'sig',
      }),
    ).rejects.toThrow('Payment verification failed.');
  });

  it('captures, commits the reservation, creates the order, and clears the cart on a genuinely valid, gateway-confirmed payment', async () => {
    const {
      prisma,
      orderTx,
      cartService,
      razorpay,
      inventoryService,
      eventEmitter,
      service,
    } = createDeps();
    const snapshot = makeSnapshot();
    const pending = makePayment({ checkoutSnapshot: snapshot });
    prisma.payment.findUnique.mockResolvedValue(pending);
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(
      makePayment({
        status: 'CAPTURED',
        providerPaymentId: 'pay_abc',
        checkoutSnapshot: snapshot,
      }),
    );
    orderTx.order.create.mockResolvedValue(
      makeOrderRow({ id: snapshot.orderId }),
    );
    razorpay.verifyPaymentSignature.mockReturnValue(true);
    razorpay.fetchPayment.mockResolvedValue({
      providerPaymentId: 'pay_abc',
      status: 'captured',
      amount: 71.3,
    });

    const result = await service.verify('pay-1', 'user-1', {
      providerOrderId: 'order_razorpay_1',
      providerPaymentId: 'pay_abc',
      signature: 'sig',
    });

    expect(result.payment.status).toBe('CAPTURED');
    expect(result.order.id).toBe(snapshot.orderId);
    expect(inventoryService.commitReservation).toHaveBeenCalledWith(
      'res-1',
      orderTx,
    );
    expect(cartService.clearCart).toHaveBeenCalledWith('cart-1');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.captured',
      expect.objectContaining({
        orderId: snapshot.orderId,
        paymentId: 'pay-1',
      }),
    );
  });

  it('is idempotent — verifying an already-CAPTURED payment again is a safe no-op that returns the existing order, not a second one', async () => {
    const { prisma, cartService, razorpay, service } = createDeps();
    const alreadyOrdered = makePayment({
      status: 'CAPTURED',
      providerPaymentId: 'pay_abc',
      orderId: 'FOL-1',
    });
    prisma.payment.findUnique.mockResolvedValue(alreadyOrdered);
    prisma.order.findUniqueOrThrow.mockResolvedValue(makeOrderRow());
    razorpay.verifyPaymentSignature.mockReturnValue(true);
    razorpay.fetchPayment.mockResolvedValue({
      providerPaymentId: 'pay_abc',
      status: 'captured',
      amount: 71.3,
    });

    const result = await service.verify('pay-1', 'user-1', {
      providerOrderId: 'order_razorpay_1',
      providerPaymentId: 'pay_abc',
      signature: 'sig',
    });

    expect(result.order.id).toBe('FOL-1');
    expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    expect(cartService.clearCart).not.toHaveBeenCalled();
  });

  it('loses the race to expireStalePayments loudly — refuses to create an order when the capture arrives after this payment was already expired', async () => {
    const { prisma, razorpay, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(makePayment());
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(
      makePayment({ status: 'EXPIRED' }),
    );
    razorpay.verifyPaymentSignature.mockReturnValue(true);
    razorpay.fetchPayment.mockResolvedValue({
      providerPaymentId: 'pay_abc',
      status: 'captured',
      amount: 71.3,
    });

    await expect(
      service.verify('pay-1', 'user-1', {
        providerOrderId: 'order_razorpay_1',
        providerPaymentId: 'pay_abc',
        signature: 'sig',
      }),
    ).rejects.toThrow(/expired/i);
  });
});

describe('PaymentsService.handleWebhookEvent', () => {
  const rawBody = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: { id: 'pay_webhook_1', order_id: 'order_razorpay_1' },
      },
    },
  });

  it('rejects an invalid webhook signature before ever touching the database', async () => {
    const { prisma, razorpay, service } = createDeps();
    razorpay.verifyWebhookSignature.mockReturnValue(false);

    await expect(
      service.handleWebhookEvent(rawBody, 'bad-sig', 'evt_1'),
    ).rejects.toThrow('Invalid webhook signature.');
    expect(prisma.paymentWebhookEvent.create).not.toHaveBeenCalled();
  });

  it('captures the payment and creates the order on a valid payment.captured event — the authoritative path, independent of whether the client ever called verify()', async () => {
    const { prisma, orderTx, razorpay, service } = createDeps();
    razorpay.verifyWebhookSignature.mockReturnValue(true);
    prisma.paymentWebhookEvent.create.mockResolvedValue({});
    prisma.payment.findFirst.mockResolvedValue(makePayment());
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(
      makePayment({ status: 'CAPTURED', providerPaymentId: 'pay_webhook_1' }),
    );

    const result = await service.handleWebhookEvent(rawBody, 'sig', 'evt_1');

    expect(result.status).toBe('processed');
    expect(orderTx.order.create).toHaveBeenCalled();
  });

  it('is idempotent — a redelivered event (same providerEventId) is rejected by the DB unique constraint and treated as a safe duplicate, never reprocessed', async () => {
    const { prisma, razorpay, service } = createDeps();
    razorpay.verifyWebhookSignature.mockReturnValue(true);
    prisma.paymentWebhookEvent.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
    );

    const result = await service.handleWebhookEvent(rawBody, 'sig', 'evt_1');

    expect(result.status).toBe('duplicate');
    expect(prisma.payment.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a malformed payload after signature verification but before recording it', async () => {
    const { prisma, razorpay, service } = createDeps();
    razorpay.verifyWebhookSignature.mockReturnValue(true);

    await expect(
      service.handleWebhookEvent('{not json', 'sig', 'evt_1'),
    ).rejects.toThrow('Malformed webhook payload.');
    expect(prisma.paymentWebhookEvent.create).not.toHaveBeenCalled();
  });
});

describe('PaymentsService.retry', () => {
  it('opens a fresh Razorpay order against the SAME payment row rather than creating a second Payment — keyed by paymentId (Phase 2), not orderId', async () => {
    const { prisma, razorpay, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ status: 'FAILED' }),
    );
    razorpay.createOrder.mockResolvedValue({
      providerOrderId: 'order_retry_1',
    });

    const result = await service.retry('pay-1', 'user-1');

    expect(razorpay.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ receipt: 'pay-1' }),
    );
    expect(result.gateway?.providerOrderId).toBe('order_retry_1');
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { status: 'CREATED', providerOrderId: 'order_retry_1' },
    });
  });

  it('refuses to retry a payment that already succeeded', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ status: 'CAPTURED' }),
    );

    await expect(service.retry('pay-1', 'user-1')).rejects.toThrow(
      'This order has already been paid for.',
    );
  });

  it('refuses to retry an already-expired payment', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ status: 'EXPIRED' }),
    );

    await expect(service.retry('pay-1', 'user-1')).rejects.toThrow(
      'This payment has expired. Please start checkout again.',
    );
  });

  it('refuses to retry a COD payment — there is no gateway attempt to retry', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ provider: 'COD', status: 'COD_PENDING' }),
    );

    await expect(service.retry('pay-1', 'user-1')).rejects.toThrow(
      'Cash on Delivery orders cannot be retried.',
    );
  });

  it("throws ForbiddenException for someone else's payment", async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ userId: 'someone-else' }),
    );

    await expect(service.retry('pay-1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('throws NotFoundException for an unknown payment', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(null);

    await expect(service.retry('unknown', 'user-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('PaymentsService.refund', () => {
  it('refunds a captured payment against the real gateway and marks it REFUNDED', async () => {
    const { prisma, razorpay, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ status: 'CAPTURED', providerPaymentId: 'pay_abc' }),
    );
    razorpay.refund.mockResolvedValue({ providerRefundId: 'rfnd_1' });
    prisma.refund.create.mockResolvedValue({
      id: 'refund-1',
      status: 'PROCESSED',
    });

    const result = await service.refund('pay-1', {});

    expect(razorpay.refund).toHaveBeenCalledWith(
      expect.objectContaining({ providerPaymentId: 'pay_abc' }),
    );
    expect(result.providerRefundId).toBe('rfnd_1');
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'REFUNDED' } }),
    );
  });

  it('marks PARTIALLY_REFUNDED, not REFUNDED, when the refund amount is less than the full payment', async () => {
    const { prisma, razorpay, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({
        status: 'CAPTURED',
        providerPaymentId: 'pay_abc',
        amount: decimal(100),
      }),
    );
    razorpay.refund.mockResolvedValue({ providerRefundId: 'rfnd_1' });
    prisma.refund.create.mockResolvedValue({
      id: 'refund-1',
      status: 'PROCESSED',
    });

    await service.refund('pay-1', { amount: 40 });

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PARTIALLY_REFUNDED' } }),
    );
  });

  it('rejects refunding a payment that was never captured', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ status: 'CREATED' }),
    );

    await expect(service.refund('pay-1', {})).rejects.toThrow(
      'Only a captured payment can be refunded.',
    );
  });

  it('rejects a duplicate refund of an already-fully-REFUNDED payment', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ status: 'REFUNDED' }),
    );

    await expect(service.refund('pay-1', {})).rejects.toThrow(
      'Only a captured payment can be refunded.',
    );
  });
});

describe('PaymentsService.expireStalePayments', () => {
  it('expires a stale CREATED payment and releases its reservations', async () => {
    const { prisma, inventoryService, service } = createDeps();
    const stalePayment = makePayment({
      status: 'CREATED',
      createdAt: new Date(
        Date.now() - (PAYMENT_EXPIRY_MINUTES + 5) * 60 * 1000,
      ),
      checkoutSnapshot: makeSnapshot({
        items: [
          {
            productId: 'prod-1',
            slug: 'monstera',
            name: 'Monstera',
            categorySlug: 'plants',
            variantId: null,
            variantLabel: null,
            price: 65,
            quantity: 1,
            inventoryItemId: 'inv-1',
            reservationId: 'res-a',
          },
          {
            productId: 'prod-2',
            slug: 'pothos',
            name: 'Pothos',
            categorySlug: 'plants',
            variantId: null,
            variantLabel: null,
            price: 20,
            quantity: 1,
            inventoryItemId: 'inv-2',
            reservationId: 'res-b',
          },
        ],
      }),
    });
    prisma.payment.findMany.mockResolvedValue([stalePayment]);
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });

    const count = await service.expireStalePayments();

    expect(count).toBe(1);
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', status: 'CREATED' },
      data: { status: 'EXPIRED' },
    });
    expect(inventoryService.releaseReservation).toHaveBeenCalledWith('res-a');
    expect(inventoryService.releaseReservation).toHaveBeenCalledWith('res-b');
  });

  it('backs off entirely — releases nothing — when it loses the atomic CREATED→EXPIRED race to a concurrent capture', async () => {
    const { prisma, inventoryService, service } = createDeps();
    const stalePayment = makePayment({
      status: 'CREATED',
      createdAt: new Date(
        Date.now() - (PAYMENT_EXPIRY_MINUTES + 5) * 60 * 1000,
      ),
    });
    prisma.payment.findMany.mockResolvedValue([stalePayment]);
    prisma.payment.updateMany.mockResolvedValue({ count: 0 }); // lost the race — already CAPTURED elsewhere

    const count = await service.expireStalePayments();

    expect(count).toBe(0);
    expect(inventoryService.releaseReservation).not.toHaveBeenCalled();
  });

  it('only queries payments older than the expiry window', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findMany.mockResolvedValue([]);

    await service.expireStalePayments();

    const call = prisma.payment.findMany.mock.calls[0][0] as {
      where: { status: string; createdAt: { lt: Date } };
    };
    expect(call.where.status).toBe('CREATED');
    const ageMinutes = (Date.now() - call.where.createdAt.lt.getTime()) / 60000;
    expect(ageMinutes).toBeCloseTo(PAYMENT_EXPIRY_MINUTES, 0);
  });
});
