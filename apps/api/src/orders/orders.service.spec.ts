/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// Same reasoning as auth.service.spec.ts's top-of-file comment.
import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import type { CheckoutDto } from './dto/checkout.dto';

function decimal(value: number) {
  return { toNumber: () => value };
}

function makeCartItem(overrides: Record<string, unknown> = {}) {
  return {
    productId: 'prod-1',
    variantId: null,
    quantity: 2,
    unitPrice: decimal(30),
    product: {
      slug: 'monstera',
      name: 'Monstera',
      category: { slug: 'plants' },
    },
    variant: null,
    ...overrides,
  };
}

function makeAddress(overrides: Record<string, unknown> = {}) {
  return {
    id: 'addr-1',
    userId: 'user-1',
    fullName: 'Sam Rivera',
    phone: '555-0100',
    addressLine1: '123 Main St',
    city: 'Portland',
    state: 'OR',
    country: 'US',
    postalCode: '97201',
    type: 'HOME',
    isDefaultShipping: false,
    isDefaultBilling: false,
    ...overrides,
  };
}

function makeCreatedOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'FOL-20260829-1234',
    createdAt: new Date(),
    status: 'PROCESSING',
    items: [],
    subtotal: decimal(60),
    discount: decimal(0),
    couponCode: null,
    shippingCost: decimal(6.5),
    tax: decimal(4.8),
    total: decimal(71.3),
    shippingAddressSnapshot: makeAddress(),
    billingAddressSnapshot: makeAddress(),
    deliveryMethod: 'STANDARD',
    estimatedDelivery: '3–5 business days',
    paymentMethod: 'COD',
    paymentDisplayLabel: 'Pay on delivery',
    paymentTransactionId: 'txn_x',
    courierId: 'SWIFTPOST',
    trackingNumber: 'SW123456789',
    customerNotes: null,
    ...overrides,
  };
}

const BASE_DTO: CheckoutDto = {
  shippingAddressId: 'addr-1',
  billingAddressId: 'addr-1',
  deliveryMethod: 'standard',
  paymentMethod: 'cod', // COD never simulates a decline — keeps most tests deterministic
  paymentDisplayLabel: 'Pay on delivery',
};

function createDeps() {
  const prisma = {
    order: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue(makeCreatedOrder()),
    },
    cancellationRequest: { create: jest.fn() },
    returnRequest: { create: jest.fn() },
    orderItem: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const cartService = {
    resolveCart: jest
      .fn()
      .mockResolvedValue({ cart: { id: 'cart-1', items: [makeCartItem()] } }),
    clearCart: jest.fn(),
    addItem: jest.fn(),
  };
  const addressesService = {
    findOwnedOrThrow: jest.fn().mockResolvedValue(makeAddress()),
  };
  const couponsService = { validate: jest.fn() };
  // Phase 1 (payments): checkout() now hands off to
  // PaymentsService.createForOrder rather than deciding success/failure
  // itself — this mock stands in for the real (separately tested, see
  // payments.service.spec.ts) COD path, which always resolves
  // synchronously with no gateway round-trip.
  const paymentsService = {
    createForOrder: jest.fn().mockResolvedValue({
      paymentId: 'pay-1',
      status: 'COD_PENDING',
      requiresGatewayCheckout: false,
    }),
    cancelForOrder: jest.fn(),
  };
  const inventoryService = {
    getAvailability: jest.fn().mockResolvedValue(100),
    decrementForProduct: jest.fn().mockResolvedValue('inv-item-1'),
    restoreQuantity: jest.fn(),
  };
  const trackingService = { simulate: jest.fn() };
  const config = { razorpayKeyId: 'rzp_test_fake' };

  const service = new OrdersService(
    prisma as never,
    cartService as never,
    addressesService as never,
    couponsService as never,
    paymentsService as never,
    inventoryService as never,
    trackingService,
    config as never,
  );

  return {
    prisma,
    cartService,
    addressesService,
    couponsService,
    paymentsService,
    inventoryService,
    trackingService,
    config,
    service,
  };
}

describe('OrdersService.checkout', () => {
  it('rejects an empty cart before doing anything else', async () => {
    const { cartService, paymentsService, service } = createDeps();
    cartService.resolveCart.mockResolvedValue({
      cart: { id: 'cart-1', items: [] },
    });

    await expect(service.checkout('user-1', BASE_DTO)).rejects.toThrow(
      BadRequestException,
    );
    expect(paymentsService.createForOrder).not.toHaveBeenCalled();
  });

  it('verifies ownership of BOTH shipping and billing addresses via AddressesService', async () => {
    const { addressesService, prisma, service } = createDeps();
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', {
      ...BASE_DTO,
      shippingAddressId: 'ship-addr',
      billingAddressId: 'bill-addr',
    });

    expect(addressesService.findOwnedOrThrow).toHaveBeenCalledWith(
      'user-1',
      'ship-addr',
    );
    expect(addressesService.findOwnedOrThrow).toHaveBeenCalledWith(
      'user-1',
      'bill-addr',
    );
  });

  it('rejects the whole checkout — before charging payment — when any line lacks sufficient stock', async () => {
    const { inventoryService, paymentsService, service } = createDeps();
    inventoryService.getAvailability.mockResolvedValue(1); // cart wants 2

    await expect(service.checkout('user-1', BASE_DTO)).rejects.toThrow(
      BadRequestException,
    );
    expect(paymentsService.createForOrder).not.toHaveBeenCalled();
    expect(inventoryService.decrementForProduct).not.toHaveBeenCalled();
  });

  it('computes subtotal, tax (8%), and total correctly with no coupon', async () => {
    const { prisma, service } = createDeps();
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', BASE_DTO);

    // subtotal = 30 * 2 = 60; tax = 60 * 0.08 = 4.8; shipping (standard) = 6.5; total = 60 + 4.8 + 6.5 = 71.3
    const createCall = prisma.order.create.mock.calls[0][0] as {
      data: { subtotal: number; tax: number; total: number };
    };
    expect(createCall.data.subtotal).toBe(60);
    expect(createCall.data.tax).toBeCloseTo(4.8);
    expect(createCall.data.total).toBeCloseTo(71.3);
  });

  it('applies a percent coupon correctly to the discount and total', async () => {
    const { prisma, couponsService, service } = createDeps();
    couponsService.validate.mockResolvedValue({
      code: 'FOLIA10',
      type: 'percent',
      value: 10,
      description: 'x',
    });
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', { ...BASE_DTO, couponCode: 'folia10' });

    // subtotal 60, discount = 10% of 60 = 6, taxable = 54, tax = 4.32, total = 60-6+6.5+4.32 = 64.82
    const createCall = prisma.order.create.mock.calls[0][0] as {
      data: { discount: number; total: number; couponCode: string };
    };
    expect(createCall.data.discount).toBe(6);
    expect(createCall.data.total).toBeCloseTo(64.82);
    expect(createCall.data.couponCode).toBe('FOLIA10');
  });

  it('applies a fixed coupon correctly', async () => {
    const { prisma, couponsService, service } = createDeps();
    couponsService.validate.mockResolvedValue({
      code: 'WELCOME5',
      type: 'fixed',
      value: 5,
      description: 'x',
    });
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', { ...BASE_DTO, couponCode: 'welcome5' });

    const createCall = prisma.order.create.mock.calls[0][0] as {
      data: { discount: number };
    };
    expect(createCall.data.discount).toBe(5);
  });

  it('decrements inventory and creates the order BEFORE payment resolves — Phase 1 made payment asynchronous, so the order must already exist (in PENDING_PAYMENT/PROCESSING) for Payment.orderId to reference', async () => {
    const { inventoryService, prisma, paymentsService, service } = createDeps();
    prisma.order.create.mockResolvedValue(makeCreatedOrder());
    const callOrder: string[] = [];
    inventoryService.decrementForProduct.mockImplementation(() => {
      callOrder.push('decrement');
      return Promise.resolve('inv-item-1');
    });
    prisma.order.create.mockImplementation(() => {
      callOrder.push('create-order');
      return Promise.resolve(makeCreatedOrder());
    });
    paymentsService.createForOrder.mockImplementation(() => {
      callOrder.push('create-payment');
      return Promise.resolve({
        paymentId: 'pay-1',
        status: 'COD_PENDING',
        requiresGatewayCheckout: false,
      });
    });

    await service.checkout('user-1', BASE_DTO);

    expect(callOrder).toEqual(['decrement', 'create-order', 'create-payment']);
  });

  it('rolls back — cancels the order and restores the exact decremented quantity — if PaymentsService.createForOrder itself throws (found by actually running this against a live database: without this, a Razorpay outage/misconfiguration would strand an order with real stock gone and no Payment row for the expiry sweep to ever find)', async () => {
    const { inventoryService, prisma, paymentsService, service } = createDeps();
    inventoryService.decrementForProduct.mockResolvedValue('inv-item-42');
    prisma.order.create.mockResolvedValue(makeCreatedOrder({ id: 'FOL-rollback' }));
    paymentsService.createForOrder.mockRejectedValue(
      new BadRequestException('Card/UPI/net-banking/wallet payments are not available right now.'),
    );

    await expect(
      service.checkout('user-1', { ...BASE_DTO, paymentMethod: 'credit-card' }),
    ).rejects.toThrow('Card/UPI/net-banking/wallet payments are not available right now.');

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'FOL-rollback' },
      data: { status: 'CANCELLED' },
    });
    expect(inventoryService.restoreQuantity).toHaveBeenCalledWith('inv-item-42', 2); // BASE_DTO's cart line quantity, from makeCartItem()
  });

  it('decrements inventory for every cart line', async () => {
    const { inventoryService, prisma, service } = createDeps();
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', BASE_DTO);

    expect(inventoryService.decrementForProduct).toHaveBeenCalledWith(
      'prod-1',
      null,
      2,
    );
  });

  it('records which exact inventory item each order line was decremented from, so a failed/expired payment can restore it precisely', async () => {
    const { inventoryService, prisma, service } = createDeps();
    inventoryService.decrementForProduct.mockResolvedValue('warehouse-b-item');
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', BASE_DTO);

    const createCall = prisma.order.create.mock.calls[0][0] as {
      data: { items: { create: { inventoryItemId: string }[] } };
    };
    expect(createCall.data.items.create[0].inventoryItemId).toBe(
      'warehouse-b-item',
    );
  });

  it('hands off to PaymentsService.createForOrder with the real order id, amount, and method — this, not checkout() itself, is what resolves payment and eventually clears the cart (see payments.service.spec.ts)', async () => {
    const { paymentsService, prisma, service } = createDeps();
    prisma.order.create.mockResolvedValue(makeCreatedOrder({ id: 'FOL-x' }));

    await service.checkout('user-1', BASE_DTO);

    expect(paymentsService.createForOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'FOL-x',
        userId: 'user-1',
        method: 'COD',
        amount: 71.3,
        displayLabel: 'Pay on delivery',
      }),
    );
  });

  it("creates a gateway-method order in PENDING_PAYMENT, not PROCESSING — a customer hasn't paid yet", async () => {
    const { prisma, service } = createDeps();
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', {
      ...BASE_DTO,
      paymentMethod: 'credit-card',
    });

    const createCall = prisma.order.create.mock.calls[0][0] as {
      data: { status: string };
    };
    expect(createCall.data.status).toBe('PENDING_PAYMENT');
  });

  it('creates a COD order straight into PROCESSING — nothing to wait for', async () => {
    const { prisma, service } = createDeps();
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', BASE_DTO);

    const createCall = prisma.order.create.mock.calls[0][0] as {
      data: { status: string };
    };
    expect(createCall.data.status).toBe('PROCESSING');
  });

  it('generates a real FOL-format order id and assigns a courier + tracking number deterministically from it', async () => {
    const { prisma, service } = createDeps();
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', BASE_DTO);

    const createCall = prisma.order.create.mock.calls[0][0] as {
      data: { id: string; courierId: string; trackingNumber: string };
    };
    expect(createCall.data.id).toMatch(/^FOL-\d{8}-\d{4}$/);
    expect(createCall.data.trackingNumber).toMatch(/^[A-Z]{2}\d{9}$/);
  });

  it('snapshots the full address objects, not just a subset of fields', async () => {
    const { prisma, addressesService, service } = createDeps();
    addressesService.findOwnedOrThrow.mockResolvedValue(
      makeAddress({ email: 'sam@example.com', label: 'Home' }),
    );
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', BASE_DTO);

    const createCall = prisma.order.create.mock.calls[0][0] as {
      data: { shippingAddressSnapshot: { email?: string; label?: string } };
    };
    expect(createCall.data.shippingAddressSnapshot.email).toBe(
      'sam@example.com',
    );
    expect(createCall.data.shippingAddressSnapshot.label).toBe('Home');
  });
});

describe('OrdersService.requestCancellation', () => {
  it('rejects when the order does not exist for this user', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst = jest.fn().mockResolvedValue(null);
    await expect(
      service.requestCancellation('user-1', 'order-1', {
        reason: 'changed-mind',
      }),
    ).rejects.toThrow('Order not found.');
  });

  it('rejects when the order status is not cancellable', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst = jest.fn().mockResolvedValue({
      status: 'DELIVERED',
      cancellation: null,
      paymentMethod: 'COD',
    });
    await expect(
      service.requestCancellation('user-1', 'order-1', {
        reason: 'changed-mind',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('sets hasRefund to false for a COD order (nothing was ever charged)', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst = jest.fn().mockResolvedValue({
      status: 'PROCESSING',
      cancellation: null,
      paymentMethod: 'COD',
    });
    prisma.$transaction = jest.fn().mockResolvedValue([{}, {}]);
    prisma.order.findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        status: 'PROCESSING',
        cancellation: null,
        paymentMethod: 'COD',
      })
      .mockResolvedValueOnce(makeCreatedOrder());

    await service.requestCancellation('user-1', 'order-1', {
      reason: 'changed-mind',
    });

    const txCalls = prisma.$transaction.mock.calls[0][0] as unknown[];
    expect(txCalls).toBeDefined();
    expect(prisma.cancellationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasRefund: false }),
      }),
    );
  });

  it('sets hasRefund to true for a real charged payment method', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        status: 'PROCESSING',
        cancellation: null,
        paymentMethod: 'CREDIT_CARD',
      })
      .mockResolvedValueOnce(makeCreatedOrder());
    prisma.$transaction = jest.fn().mockResolvedValue([{}, {}]);

    await service.requestCancellation('user-1', 'order-1', {
      reason: 'changed-mind',
    });

    expect(prisma.cancellationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasRefund: true }),
      }),
    );
  });

  it('restores stock and closes out the payment when cancelling BEFORE payment ever completed (Phase 1) — nothing was charged, so hasRefund is false even for a gateway method', async () => {
    const { prisma, paymentsService, inventoryService, service } = createDeps();
    prisma.order.findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        status: 'PENDING_PAYMENT',
        cancellation: null,
        paymentMethod: 'CREDIT_CARD',
        items: [
          { inventoryItemId: 'inv-1', quantity: 2 },
          { inventoryItemId: 'inv-2', quantity: 1 },
        ],
      })
      .mockResolvedValueOnce(makeCreatedOrder());
    prisma.$transaction = jest.fn().mockResolvedValue([{}, {}]);

    await service.requestCancellation('user-1', 'order-1', {
      reason: 'changed-mind',
    });

    expect(prisma.cancellationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasRefund: false }),
      }),
    );
    expect(paymentsService.cancelForOrder).toHaveBeenCalledWith('order-1');
    expect(inventoryService.restoreQuantity).toHaveBeenCalledWith('inv-1', 2);
    expect(inventoryService.restoreQuantity).toHaveBeenCalledWith('inv-2', 1);
  });

  it('does NOT restore stock or touch the payment when cancelling an already-paid (PROCESSING) order — that stock is genuinely committed', async () => {
    const { prisma, paymentsService, inventoryService, service } = createDeps();
    prisma.order.findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        status: 'PROCESSING',
        cancellation: null,
        paymentMethod: 'COD',
        items: [{ inventoryItemId: 'inv-1', quantity: 2 }],
      })
      .mockResolvedValueOnce(makeCreatedOrder());
    prisma.$transaction = jest.fn().mockResolvedValue([{}, {}]);

    await service.requestCancellation('user-1', 'order-1', {
      reason: 'changed-mind',
    });

    expect(paymentsService.cancelForOrder).not.toHaveBeenCalled();
    expect(inventoryService.restoreQuantity).not.toHaveBeenCalled();
  });
});

describe('OrdersService.requestReturn', () => {
  it('rejects when the order is not delivered', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst = jest.fn().mockResolvedValue({
      status: 'SHIPPED',
      returnRequest: null,
      createdAt: new Date(),
    });
    await expect(
      service.requestReturn('user-1', 'order-1', { reason: 'wrong-item' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('succeeds for a recently delivered order with no existing return', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        status: 'DELIVERED',
        returnRequest: null,
        createdAt: new Date(),
      })
      .mockResolvedValueOnce(makeCreatedOrder());
    prisma.$transaction = jest.fn().mockResolvedValue([{}, {}]);

    await expect(
      service.requestReturn('user-1', 'order-1', { reason: 'wrong-item' }),
    ).resolves.toBeDefined();
    expect(prisma.returnRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reason: 'WRONG_ITEM' }),
      }),
    );
  });
});

describe('OrdersService.getTracking', () => {
  it('throws NotFoundException for an order that does not belong to this user', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst = jest.fn().mockResolvedValue(null);
    await expect(service.getTracking('user-1', 'order-1')).rejects.toThrow(
      'Order not found.',
    );
  });

  it('freezes the simulation at the cancellation time for a cancelled order', async () => {
    const { prisma, trackingService, service } = createDeps();
    const cancelledAt = new Date('2026-01-02T00:00:00Z');
    prisma.order.findFirst = jest.fn().mockResolvedValue({
      createdAt: new Date('2026-01-01T00:00:00Z'),
      deliveryMethod: 'STANDARD',
      shippingAddressSnapshot: { city: 'Portland' },
      courierId: 'SWIFTPOST',
      trackingNumber: 'SW123456789',
      cancellation: { requestedAt: cancelledAt },
      returnRequest: null,
    });

    await service.getTracking('user-1', 'order-1');

    expect(trackingService.simulate).toHaveBeenCalledWith(
      expect.objectContaining({ frozenAt: cancelledAt }),
    );
  });

  it('does not freeze the simulation for a normal, non-cancelled order', async () => {
    const { prisma, trackingService, service } = createDeps();
    prisma.order.findFirst = jest.fn().mockResolvedValue({
      createdAt: new Date('2026-01-01T00:00:00Z'),
      deliveryMethod: 'STANDARD',
      shippingAddressSnapshot: { city: 'Portland' },
      courierId: 'SWIFTPOST',
      trackingNumber: 'SW123456789',
      cancellation: null,
      returnRequest: null,
    });

    await service.getTracking('user-1', 'order-1');

    expect(trackingService.simulate).toHaveBeenCalledWith(
      expect.objectContaining({ frozenAt: undefined }),
    );
  });
});

describe('OrdersService.getPurchasedProductIds', () => {
  it("returns distinct product ids scoped to the given user's orders only", async () => {
    const { prisma, service } = createDeps();
    prisma.orderItem.findMany.mockResolvedValue([
      { productId: 'prod-1' },
      { productId: 'prod-2' },
    ]);

    const result = await service.getPurchasedProductIds('user-1');

    expect(prisma.orderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { order: { userId: 'user-1' } },
        distinct: ['productId'],
      }),
    );
    expect(result).toEqual(['prod-1', 'prod-2']);
  });
});

describe('OrdersService.adminFindAll', () => {
  it('returns orders across every customer, not scoped to one user', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findMany.mockResolvedValue([]);
    await service.adminFindAll();
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }), // no userId filter at all
    );
  });

  it('applies a status filter when provided', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findMany.mockResolvedValue([]);
    await service.adminFindAll({ status: 'SHIPPED' });
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'SHIPPED' } }),
    );
  });
});

describe('OrdersService.adminUpdateStatus', () => {
  it('throws NotFoundException for an unknown order', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(
      service.adminUpdateStatus('unknown', 'CONFIRMED'),
    ).rejects.toThrow('Order not found.');
  });

  it('rejects an invalid transition with a clear, specific error message', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PROCESSING',
      userId: 'user-1',
    });
    await expect(
      service.adminUpdateStatus('order-1', 'DELIVERED'),
    ).rejects.toThrow('Cannot move an order from PROCESSING to DELIVERED.');
  });

  it('never even attempts to write an invalid transition', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'DELIVERED',
      userId: 'user-1',
    });
    prisma.order.update.mockClear();
    await service
      .adminUpdateStatus('order-1', 'CANCELLED')
      .catch(() => undefined);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('applies a valid transition and returns the updated order', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'PROCESSING',
      userId: 'user-1',
    });
    prisma.order.update.mockResolvedValue({});
    prisma.order.findFirst.mockResolvedValue(makeCreatedOrder());

    await service.adminUpdateStatus('order-1', 'CONFIRMED');

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { status: 'CONFIRMED' },
    });
  });
});

describe('OrdersService.checkout idempotency', () => {
  it('returns the existing order for a repeated idempotency key, without touching the cart, payment, or inventory again', async () => {
    const { prisma, cartService, paymentsService, inventoryService, service } =
      createDeps();
    prisma.order.findUnique = jest
      .fn()
      .mockResolvedValue(makeCreatedOrder({ id: 'FOL-original' }));

    const result = await service.checkout('user-1', BASE_DTO, 'idem-key-123');

    expect(result.id).toBe('FOL-original');
    expect(result.isIdempotentReplay).toBe(true);
    expect(cartService.resolveCart).not.toHaveBeenCalled();
    expect(paymentsService.createForOrder).not.toHaveBeenCalled();
    expect(inventoryService.decrementForProduct).not.toHaveBeenCalled();
  });

  it('checks for an existing order scoped to THIS user and key, via the real compound unique constraint', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findUnique = jest.fn().mockResolvedValue(null);
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', BASE_DTO, 'idem-key-123');

    expect(prisma.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_idempotencyKey: {
            userId: 'user-1',
            idempotencyKey: 'idem-key-123',
          },
        },
      }),
    );
  });

  it('proceeds normally (no idempotency check at all) when no key is supplied', async () => {
    const { prisma, service } = createDeps();
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', BASE_DTO);

    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });

  it('marks a genuinely new order as isIdempotentReplay: false, not just omitting the field', async () => {
    const { prisma, service } = createDeps();
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    const result = await service.checkout('user-1', BASE_DTO, 'a-new-key');

    expect(result.isIdempotentReplay).toBe(false);
  });

  it('stores the supplied idempotency key on the newly created order', async () => {
    const { prisma, service } = createDeps();
    prisma.order.create.mockResolvedValue(makeCreatedOrder());

    await service.checkout('user-1', BASE_DTO, 'store-me-123');

    const createCall = prisma.order.create.mock.calls[0][0] as {
      data: { idempotencyKey: string | null };
    };
    expect(createCall.data.idempotencyKey).toBe('store-me-123');
  });
});

describe('OrdersService.updateNotes', () => {
  it('scopes the update to {id, userId} and returns the updated order', async () => {
    const { prisma, service } = createDeps();
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.findFirst.mockResolvedValue(makeCreatedOrder());

    await service.updateNotes('user-1', 'FOL-1', 'Leave at the door');

    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'FOL-1', userId: 'user-1' },
      data: { customerNotes: 'Leave at the door' },
    });
  });

  it('stores an empty string as null, matching the original local behavior exactly', async () => {
    const { prisma, service } = createDeps();
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.order.findFirst.mockResolvedValue(makeCreatedOrder());

    await service.updateNotes('user-1', 'FOL-1', '');

    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'FOL-1', userId: 'user-1' },
      data: { customerNotes: null },
    });
  });

  it('throws NotFoundException — a real error, not a silent no-op — for an order that belongs to someone else', async () => {
    const { prisma, service } = createDeps();
    prisma.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateNotes('user-1', 'someone-elses-order', 'x'),
    ).rejects.toThrow('Order not found.');
  });
});

describe('OrdersService.reorder', () => {
  function makeOrderWithItems(items: Record<string, unknown>[]) {
    return { id: 'FOL-1', userId: 'user-1', items };
  }

  it('adds every item back to the cart when everything is still available', async () => {
    const { prisma, cartService, inventoryService, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrderWithItems([
        { productId: 'prod-1', variantId: null, quantity: 2 },
        { productId: 'prod-2', variantId: 'var-1', quantity: 1 },
      ]),
    );
    inventoryService.getAvailability.mockResolvedValue(10);

    const result = await service.reorder('user-1', 'FOL-1');

    expect(result).toEqual({ added: 2, skipped: 0 });
    expect(cartService.addItem).toHaveBeenCalledTimes(2);
  });

  it('skips an item with zero real current availability, rather than adding it anyway', async () => {
    const { prisma, cartService, inventoryService, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrderWithItems([
        { productId: 'prod-1', variantId: null, quantity: 2 },
      ]),
    );
    inventoryService.getAvailability.mockResolvedValue(0);

    const result = await service.reorder('user-1', 'FOL-1');

    expect(result).toEqual({ added: 0, skipped: 1 });
    expect(cartService.addItem).not.toHaveBeenCalled();
  });

  it('caps the added quantity at real current availability, never trusting the original order quantity blindly', async () => {
    const { prisma, cartService, inventoryService, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(
      makeOrderWithItems([
        { productId: 'prod-1', variantId: null, quantity: 5 },
      ]),
    );
    inventoryService.getAvailability.mockResolvedValue(2);

    await service.reorder('user-1', 'FOL-1');

    expect(cartService.addItem).toHaveBeenCalledWith(
      'cart-1',
      'prod-1',
      null,
      2,
    );
  });

  it("throws NotFoundException for an order that doesn't belong to this user", async () => {
    const { prisma, service } = createDeps();
    prisma.order.findFirst.mockResolvedValue(null);

    await expect(
      service.reorder('user-1', 'someone-elses-order'),
    ).rejects.toThrow('Order not found.');
  });
});
