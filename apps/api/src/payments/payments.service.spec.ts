/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// Same reasoning as auth.service.spec.ts's top-of-file comment.
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService, PAYMENT_EXPIRY_MINUTES } from './payments.service';

function decimal(value: number) {
  return value; // Prisma Decimal in these mocks is just a plain number — Number(payment.amount) works either way, matching this codebase's existing decimal() test-helper convention elsewhere.
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay-1',
    orderId: 'FOL-1',
    userId: 'user-1',
    provider: 'RAZORPAY',
    method: 'CREDIT_CARD',
    status: 'CREATED',
    amount: decimal(71.3),
    currency: 'INR',
    providerOrderId: 'order_razorpay_1',
    providerPaymentId: null,
    displayLabel: 'Visa •••• 4242',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createDeps() {
  const prisma = {
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    paymentAttempt: { create: jest.fn() },
    refund: { create: jest.fn() },
    paymentWebhookEvent: { create: jest.fn(), update: jest.fn() },
    order: { update: jest.fn() },
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
  const inventoryService = { restoreQuantity: jest.fn() };
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
      orderId: 'FOL-1',
      userId: 'user-1',
      method: 'COD',
      amount: 71.3,
      displayLabel: 'Pay on delivery',
    });

    expect(result.requiresGatewayCheckout).toBe(false);
    expect(razorpay.createOrder).not.toHaveBeenCalled();
  });

  it('immediately flips the order to PROCESSING and sets paymentTransactionId to the Payment id (never a fabricated txn_ string)', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.create.mockResolvedValue(
      makePayment({ id: 'pay-cod-1', provider: 'COD', status: 'COD_PENDING' }),
    );

    await service.createForOrder({
      orderId: 'FOL-1',
      userId: 'user-1',
      method: 'COD',
      amount: 71.3,
      displayLabel: 'Pay on delivery',
    });

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'FOL-1' },
      data: expect.objectContaining({
        status: 'PROCESSING',
        paymentTransactionId: 'pay-cod-1',
        paymentDisplayLabel: 'Pay on delivery',
      }),
    });
  });

  it('clears the cart immediately for COD, since there is nothing asynchronous to wait for', async () => {
    const { prisma, cartService, service } = createDeps();
    prisma.payment.create.mockResolvedValue(makePayment({ provider: 'COD' }));

    await service.createForOrder({
      orderId: 'FOL-1',
      userId: 'user-1',
      method: 'COD',
      amount: 71.3,
      displayLabel: 'Pay on delivery',
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
      orderId: 'FOL-1',
      userId: 'user-1',
      method: 'CREDIT_CARD',
      amount: 71.3,
      displayLabel: 'Visa •••• 4242',
    });

    expect(razorpay.createOrder).toHaveBeenCalledWith({
      amount: 71.3,
      currency: 'INR',
      receipt: 'FOL-1',
    });
    expect(result.requiresGatewayCheckout).toBe(true);
    expect(result.gateway).toEqual({
      keyId: 'rzp_test_key',
      providerOrderId: 'order_abc',
      amount: 71.3,
      currency: 'INR',
    });
  });

  it('does NOT touch the order or clear the cart yet — nothing is confirmed until verify()/the webhook resolves it', async () => {
    const { prisma, cartService, razorpay, service } = createDeps();
    razorpay.createOrder.mockResolvedValue({ providerOrderId: 'order_abc' });
    prisma.payment.create.mockResolvedValue(makePayment());

    await service.createForOrder({
      orderId: 'FOL-1',
      userId: 'user-1',
      method: 'UPI',
      amount: 71.3,
      displayLabel: 'you@bank',
    });

    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(cartService.clearCart).not.toHaveBeenCalled();
  });

  it('rejects up front, before ever creating a Payment row, when Razorpay is not configured at all', async () => {
    const { config, prisma, razorpay, service } = createDeps();
    config.razorpayKeyId = undefined as never;

    await expect(
      service.createForOrder({
        orderId: 'FOL-1',
        userId: 'user-1',
        method: 'CREDIT_CARD',
        amount: 71.3,
        displayLabel: 'Visa •••• 4242',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(razorpay.createOrder).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('propagates a gateway failure (e.g. a timeout) rather than silently creating a Payment for an order that has no real gateway order behind it', async () => {
    const { prisma, razorpay, service } = createDeps();
    razorpay.createOrder.mockRejectedValue(new Error('ETIMEDOUT'));

    await expect(
      service.createForOrder({
        orderId: 'FOL-1',
        userId: 'user-1',
        method: 'CREDIT_CARD',
        amount: 71.3,
        displayLabel: 'Visa •••• 4242',
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
    expect(prisma.payment.update).toHaveBeenCalledWith(
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

  it('captures, updates the order to PROCESSING, and clears the cart on a genuinely valid, gateway-confirmed payment', async () => {
    const { prisma, cartService, razorpay, eventEmitter, service } =
      createDeps();
    prisma.payment.findUnique.mockResolvedValue(makePayment());
    prisma.payment.update.mockResolvedValue(
      makePayment({ status: 'CAPTURED', providerPaymentId: 'pay_abc' }),
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

    expect(result.status).toBe('CAPTURED');
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'FOL-1' },
      data: expect.objectContaining({
        status: 'PROCESSING',
        paymentTransactionId: 'pay_abc',
      }),
    });
    expect(cartService.clearCart).toHaveBeenCalledWith('cart-1');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.captured',
      expect.objectContaining({ orderId: 'FOL-1', paymentId: 'pay-1' }),
    );
  });

  it('is idempotent — verifying an already-CAPTURED payment again is a safe no-op, not a double cart-clear or double event', async () => {
    const { prisma, cartService, razorpay, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ status: 'CAPTURED', providerPaymentId: 'pay_abc' }),
    );
    razorpay.verifyPaymentSignature.mockReturnValue(true);
    razorpay.fetchPayment.mockResolvedValue({
      providerPaymentId: 'pay_abc',
      status: 'captured',
      amount: 71.3,
    });

    await service.verify('pay-1', 'user-1', {
      providerOrderId: 'order_razorpay_1',
      providerPaymentId: 'pay_abc',
      signature: 'sig',
    });

    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(cartService.clearCart).not.toHaveBeenCalled();
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

  it('captures the payment and flips the order to PROCESSING on a valid payment.captured event — the authoritative path, independent of whether the client ever called verify()', async () => {
    const { prisma, razorpay, service } = createDeps();
    razorpay.verifyWebhookSignature.mockReturnValue(true);
    prisma.paymentWebhookEvent.create.mockResolvedValue({});
    prisma.payment.findFirst.mockResolvedValue(makePayment());
    prisma.payment.update.mockResolvedValue(
      makePayment({ status: 'CAPTURED' }),
    );

    const result = await service.handleWebhookEvent(rawBody, 'sig', 'evt_1');

    expect(result.status).toBe('processed');
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PROCESSING' }),
      }),
    );
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
    expect(prisma.order.update).not.toHaveBeenCalled();
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
  it('opens a fresh Razorpay order against the SAME payment row (1:1 with the order) rather than creating a second Payment', async () => {
    const { prisma, razorpay, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ status: 'FAILED' }),
    );
    razorpay.createOrder.mockResolvedValue({
      providerOrderId: 'order_retry_1',
    });

    const result = await service.retry('FOL-1', 'user-1');

    expect(result.gateway?.providerOrderId).toBe('order_retry_1');
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { status: 'CREATED', providerOrderId: 'order_retry_1' },
    });
  });

  it('refuses to retry an order that already succeeded', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ status: 'CAPTURED' }),
    );

    await expect(service.retry('FOL-1', 'user-1')).rejects.toThrow(
      'This order has already been paid for.',
    );
  });

  it('refuses to retry a COD order — there is no gateway attempt to retry', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ provider: 'COD', status: 'COD_PENDING' }),
    );

    await expect(service.retry('FOL-1', 'user-1')).rejects.toThrow(
      'Cash on Delivery orders cannot be retried.',
    );
  });

  it("throws NotFoundException for someone else's order", async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ userId: 'someone-else' }),
    );

    await expect(service.retry('FOL-1', 'user-1')).rejects.toThrow(
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
  it('expires a stale PENDING_PAYMENT order, restores its exact inventory, and never touches an order already resolved by a race with verify()/the webhook', async () => {
    const { prisma, inventoryService, service } = createDeps();
    const stalePayment = makePayment({
      status: 'CREATED',
      createdAt: new Date(
        Date.now() - (PAYMENT_EXPIRY_MINUTES + 5) * 60 * 1000,
      ),
      order: {
        status: 'PENDING_PAYMENT',
        items: [{ inventoryItemId: 'inv-1', quantity: 2 }],
      },
    });
    const resolvedByRace = makePayment({
      id: 'pay-2',
      orderId: 'FOL-2',
      status: 'CREATED',
      createdAt: new Date(
        Date.now() - (PAYMENT_EXPIRY_MINUTES + 5) * 60 * 1000,
      ),
      order: { status: 'PROCESSING', items: [] }, // captured moments before this sweep ran
    });
    prisma.payment.findMany.mockResolvedValue([stalePayment, resolvedByRace]);

    const count = await service.expireStalePayments();

    expect(count).toBe(1);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { status: 'EXPIRED' },
    });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'FOL-1' },
      data: { status: 'CANCELLED' },
    });
    expect(inventoryService.restoreQuantity).toHaveBeenCalledWith('inv-1', 2);
    expect(inventoryService.restoreQuantity).toHaveBeenCalledTimes(1); // not called at all for the race-resolved one
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

describe('PaymentsService.cancelForOrder', () => {
  it('closes out a not-yet-captured payment as EXPIRED', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ status: 'CREATED' }),
    );

    await service.cancelForOrder('FOL-1');

    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-1' },
      data: { status: 'EXPIRED' },
    });
  });

  it('never downgrades an already-CAPTURED payment — a captured payment cannot retroactively become "never paid for"', async () => {
    const { prisma, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue(
      makePayment({ status: 'CAPTURED' }),
    );

    await service.cancelForOrder('FOL-1');

    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
});
