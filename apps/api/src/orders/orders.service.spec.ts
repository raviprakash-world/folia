/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
// Same reasoning as auth.service.spec.ts's top-of-file comment.
import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PAYMENT_EXPIRY_MINUTES } from '../payments/payments.service';
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

/** Shape of a DB Order row, as `prisma.order.findFirst`/etc. would return it — still used by every method except checkout() itself (Phase 2 moved Order creation into PaymentsService.confirmAndCreateOrder). */
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
    paymentTransactionId: 'pay-1',
    courierId: 'SWIFTPOST',
    trackingNumber: 'SW123456789',
    customerNotes: null,
    ...overrides,
  };
}

/** Shape PaymentsService.createForOrder/confirmAndCreateOrder actually returns for its `order` field — order.types.ts's toPublicOrder() output, not a raw DB row. */
function makePublicOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'FOL-20260829-1234',
    createdAt: new Date().toISOString(),
    status: 'processing',
    items: [],
    subtotal: 60,
    discount: 0,
    couponCode: null,
    shippingCost: 6.5,
    tax: 4.8,
    total: 71.3,
    shippingAddress: makeAddress(),
    billingAddress: makeAddress(),
    deliveryMethod: 'standard',
    estimatedDelivery: '3–5 business days',
    payment: {
      method: 'cod',
      displayLabel: 'Pay on delivery',
      transactionId: 'pay-1',
    },
    courierId: 'swiftpost',
    trackingNumber: 'SW123456789',
    customerNotes: null,
    cancellation: null,
    returnRequest: null,
    ...overrides,
  };
}

function makeReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'res-1',
    inventoryItemId: 'inv-item-1',
    quantity: 2,
    referenceType: 'PAYMENT',
    referenceId: 'payment-generated-id',
    status: 'ACTIVE',
    expiresAt: new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60 * 1000),
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
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    payment: { findUnique: jest.fn().mockResolvedValue(null) },
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
  // Phase 2: checkout() now hands off to PaymentsService.createForOrder,
  // which itself owns Order creation (confirmAndCreateOrder) once payment
  // resolves — this mock stands in for the real (separately tested, see
  // payments.service.spec.ts) COD path, which always resolves
  // synchronously with no gateway round-trip and a real order attached.
  const paymentsService = {
    createForOrder: jest.fn().mockResolvedValue({
      paymentId: 'pay-1',
      status: 'COD_PENDING',
      requiresGatewayCheckout: false,
      order: makePublicOrder(),
    }),
  };
  const inventoryService = {
    getAvailability: jest.fn().mockResolvedValue(100),
    reserveForProduct: jest.fn().mockResolvedValue(makeReservation()),
    releaseReservation: jest.fn(),
  };
  const trackingService = { simulate: jest.fn() };
  const config = { razorpayKeyId: 'rzp_test_fake' };
  const eventEmitter = { emit: jest.fn() };
  const shippingProvider = {
    checkServiceability: jest.fn(),
    createShipment: jest.fn().mockResolvedValue({
      courierName: 'Delhivery Surface',
      awbCode: 'AWB123456789',
      trackingUrl: 'https://shiprocket.co/tracking/AWB123456789',
    }),
    trackShipment: jest.fn(),
  };

  const service = new OrdersService(
    prisma as never,
    cartService as never,
    addressesService as never,
    couponsService as never,
    paymentsService as never,
    inventoryService as never,
    trackingService,
    config as never,
    eventEmitter,
    shippingProvider,
  );

  return {
    prisma,
    cartService,
    addressesService,
    couponsService,
    paymentsService,
    inventoryService,
    eventEmitter,
    trackingService,
    config,
    shippingProvider,
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
    const { addressesService, service } = createDeps();

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

  it('rejects the whole checkout — before charging payment — when reserving any line fails for insufficient stock', async () => {
    const { inventoryService, paymentsService, service } = createDeps();
    inventoryService.reserveForProduct.mockRejectedValue(
      new BadRequestException('Not enough stock available for this item.'),
    );

    await expect(service.checkout('user-1', BASE_DTO)).rejects.toThrow(
      BadRequestException,
    );
    expect(paymentsService.createForOrder).not.toHaveBeenCalled();
  });

  it('computes subtotal, tax (8%), and total correctly with no coupon, in the checkout snapshot handed to PaymentsService', async () => {
    const { paymentsService, service } = createDeps();

    await service.checkout('user-1', BASE_DTO);

    // subtotal = 30 * 2 = 60; tax = 60 * 0.08 = 4.8; shipping (standard) = 6.5; total = 60 + 4.8 + 6.5 = 71.3
    const call = paymentsService.createForOrder.mock.calls[0][0] as {
      amount: number;
      checkoutSnapshot: { subtotal: number; tax: number; total: number };
    };
    expect(call.checkoutSnapshot.subtotal).toBe(60);
    expect(call.checkoutSnapshot.tax).toBeCloseTo(4.8);
    expect(call.checkoutSnapshot.total).toBeCloseTo(71.3);
    expect(call.amount).toBeCloseTo(71.3);
  });

  it('applies a percent coupon correctly to the discount and total', async () => {
    const { paymentsService, couponsService, service } = createDeps();
    couponsService.validate.mockResolvedValue({
      code: 'FOLIA10',
      type: 'percent',
      value: 10,
      description: 'x',
    });

    await service.checkout('user-1', { ...BASE_DTO, couponCode: 'folia10' });

    // subtotal 60, discount = 10% of 60 = 6, taxable = 54, tax = 4.32, total = 60-6+6.5+4.32 = 64.82
    const call = paymentsService.createForOrder.mock.calls[0][0] as {
      checkoutSnapshot: { discount: number; total: number; couponCode: string };
    };
    expect(call.checkoutSnapshot.discount).toBe(6);
    expect(call.checkoutSnapshot.total).toBeCloseTo(64.82);
    expect(call.checkoutSnapshot.couponCode).toBe('FOLIA10');
  });

  it('applies a fixed coupon correctly', async () => {
    const { paymentsService, couponsService, service } = createDeps();
    couponsService.validate.mockResolvedValue({
      code: 'WELCOME5',
      type: 'fixed',
      value: 5,
      description: 'x',
    });

    await service.checkout('user-1', { ...BASE_DTO, couponCode: 'welcome5' });

    const call = paymentsService.createForOrder.mock.calls[0][0] as {
      checkoutSnapshot: { discount: number };
    };
    expect(call.checkoutSnapshot.discount).toBe(5);
  });

  it('reserves inventory for every line BEFORE creating the payment — reserve-before-pay is the whole point of Phase 2', async () => {
    const { inventoryService, paymentsService, service } = createDeps();
    const callOrder: string[] = [];
    inventoryService.reserveForProduct.mockImplementation(() => {
      callOrder.push('reserve');
      return Promise.resolve(makeReservation());
    });
    paymentsService.createForOrder.mockImplementation(() => {
      callOrder.push('create-payment');
      return Promise.resolve({
        paymentId: 'pay-1',
        status: 'COD_PENDING',
        requiresGatewayCheckout: false,
        order: makePublicOrder(),
      });
    });

    await service.checkout('user-1', BASE_DTO);

    expect(callOrder).toEqual(['reserve', 'create-payment']);
  });

  it('releases every reservation just made if PaymentsService.createForOrder itself throws — there is no Order yet to roll back (Phase 2: an Order only ever exists once payment is confirmed), so releasing the reservations is the entire rollback', async () => {
    const { inventoryService, paymentsService, service } = createDeps();
    inventoryService.reserveForProduct.mockResolvedValue(
      makeReservation({ id: 'res-42', inventoryItemId: 'inv-item-42' }),
    );
    paymentsService.createForOrder.mockRejectedValue(
      new BadRequestException(
        'Card/UPI/net-banking/wallet payments are not available right now.',
      ),
    );

    await expect(
      service.checkout('user-1', { ...BASE_DTO, paymentMethod: 'credit-card' }),
    ).rejects.toThrow(
      'Card/UPI/net-banking/wallet payments are not available right now.',
    );

    expect(inventoryService.releaseReservation).toHaveBeenCalledWith('res-42');
  });

  it('reserves inventory for every cart line, against the PAYMENT reference type and the payment-expiry TTL', async () => {
    const { inventoryService, service } = createDeps();

    await service.checkout('user-1', BASE_DTO);

    expect(inventoryService.reserveForProduct).toHaveBeenCalledWith(
      'prod-1',
      null,
      2,
      'PAYMENT',
      expect.any(String),
      PAYMENT_EXPIRY_MINUTES,
    );
  });

  it('records which exact inventory item AND reservation each order line resolved to, in the checkout snapshot handed to PaymentsService', async () => {
    const { inventoryService, paymentsService, service } = createDeps();
    inventoryService.reserveForProduct.mockResolvedValue(
      makeReservation({ id: 'res-99', inventoryItemId: 'warehouse-b-item' }),
    );

    await service.checkout('user-1', BASE_DTO);

    const call = paymentsService.createForOrder.mock.calls[0][0] as {
      checkoutSnapshot: {
        items: { inventoryItemId: string; reservationId: string }[];
      };
    };
    expect(call.checkoutSnapshot.items[0].inventoryItemId).toBe(
      'warehouse-b-item',
    );
    expect(call.checkoutSnapshot.items[0].reservationId).toBe('res-99');
  });

  it('hands off to PaymentsService.createForOrder with the real amount, method, and a checkout snapshot carrying a real pre-generated order id', async () => {
    const { paymentsService, service } = createDeps();

    await service.checkout('user-1', BASE_DTO);

    expect(paymentsService.createForOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        method: 'COD',
        amount: 71.3,
        displayLabel: 'Pay on delivery',
        checkoutSnapshot: expect.objectContaining({
          orderId: expect.stringMatching(/^FOL-\d{8}-\d{4}$/),
        }),
      }),
    );
  });

  it('generates a real FOL-format order id, and does NOT assign a courier or tracking number — real fulfillment (Phase 5) only happens later, via the admin ship action', async () => {
    const { paymentsService, service } = createDeps();

    await service.checkout('user-1', BASE_DTO);

    const call = paymentsService.createForOrder.mock.calls[0][0] as {
      checkoutSnapshot: {
        orderId: string;
        courierId?: string;
        trackingNumber?: string;
      };
    };
    expect(call.checkoutSnapshot.orderId).toMatch(/^FOL-\d{8}-\d{4}$/);
    expect(call.checkoutSnapshot.courierId).toBeUndefined();
    expect(call.checkoutSnapshot.trackingNumber).toBeUndefined();
  });

  it('snapshots the full address objects, not just a subset of fields', async () => {
    const { paymentsService, addressesService, service } = createDeps();
    addressesService.findOwnedOrThrow.mockResolvedValue(
      makeAddress({ email: 'sam@example.com', label: 'Home' }),
    );

    await service.checkout('user-1', BASE_DTO);

    const call = paymentsService.createForOrder.mock.calls[0][0] as {
      checkoutSnapshot: {
        shippingAddressSnapshot: { email?: string; label?: string };
      };
    };
    expect(call.checkoutSnapshot.shippingAddressSnapshot.email).toBe(
      'sam@example.com',
    );
    expect(call.checkoutSnapshot.shippingAddressSnapshot.label).toBe('Home');
  });

  it("returns PaymentsService's real order for a COD checkout (it resolves synchronously) and the payment result verbatim", async () => {
    const { paymentsService, service } = createDeps();
    paymentsService.createForOrder.mockResolvedValue({
      paymentId: 'pay-cod-1',
      status: 'COD_PENDING',
      requiresGatewayCheckout: false,
      order: makePublicOrder({ id: 'FOL-cod' }),
    });

    const result = await service.checkout('user-1', BASE_DTO);

    expect(result.order?.id).toBe('FOL-cod');
    expect(result.payment.paymentId).toBe('pay-cod-1');
    expect(result.isIdempotentReplay).toBe(false);
  });

  it('returns a null order for a gateway checkout — nothing is confirmed until verify()/the webhook creates one', async () => {
    const { paymentsService, service } = createDeps();
    paymentsService.createForOrder.mockResolvedValue({
      paymentId: 'pay-gw-1',
      status: 'CREATED',
      requiresGatewayCheckout: true,
      gateway: {
        keyId: 'rzp_test_fake',
        providerOrderId: 'order_abc',
        amount: 71.3,
        currency: 'INR',
      },
    });

    const result = await service.checkout('user-1', {
      ...BASE_DTO,
      paymentMethod: 'credit-card',
    });

    expect(result.order).toBeNull();
    expect(result.payment.requiresGatewayCheckout).toBe(true);
  });
});

describe('OrdersService.checkout idempotency', () => {
  it('returns the existing payment/order for a repeated idempotency key, without touching the cart or reserving inventory again', async () => {
    const { prisma, cartService, paymentsService, inventoryService, service } =
      createDeps();
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-original',
      status: 'COD_PENDING',
      provider: 'COD',
      providerOrderId: null,
      amount: 71.3,
      currency: 'INR',
      order: makeCreatedOrder({ id: 'FOL-original' }),
    });

    const result = await service.checkout('user-1', BASE_DTO, 'idem-key-123');

    expect(result.isIdempotentReplay).toBe(true);
    expect((result.order as { id: string }).id).toBe('FOL-original');
    expect(cartService.resolveCart).not.toHaveBeenCalled();
    expect(paymentsService.createForOrder).not.toHaveBeenCalled();
    expect(inventoryService.reserveForProduct).not.toHaveBeenCalled();
  });

  it('checks for an existing PAYMENT (moved from Order to Payment in Phase 2) scoped to THIS user and key, via the real compound unique constraint', async () => {
    const { prisma, service } = createDeps();

    await service.checkout('user-1', BASE_DTO, 'idem-key-123');

    expect(prisma.payment.findUnique).toHaveBeenCalledWith(
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

    await service.checkout('user-1', BASE_DTO);

    expect(prisma.payment.findUnique).not.toHaveBeenCalled();
  });

  it('marks a genuinely new checkout as isIdempotentReplay: false, not just omitting the field', async () => {
    const { service } = createDeps();

    const result = await service.checkout('user-1', BASE_DTO, 'a-new-key');

    expect(result.isIdempotentReplay).toBe(false);
  });

  it('passes the supplied idempotency key through to PaymentsService.createForOrder', async () => {
    const { paymentsService, service } = createDeps();

    await service.checkout('user-1', BASE_DTO, 'store-me-123');

    expect(paymentsService.createForOrder).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'store-me-123' }),
    );
  });

  it('replays a still-pending gateway payment with its gateway checkout details, not just a bare status, and no order yet', async () => {
    const { prisma, config, service } = createDeps();
    prisma.payment.findUnique.mockResolvedValue({
      id: 'pay-pending',
      status: 'CREATED',
      provider: 'RAZORPAY',
      providerOrderId: 'order_abc',
      amount: 71.3,
      currency: 'INR',
      order: null,
    });

    const result = await service.checkout('user-1', BASE_DTO, 'idem-key-456');

    expect(result.payment.requiresGatewayCheckout).toBe(true);
    expect(result.payment.gateway).toEqual({
      keyId: config.razorpayKeyId,
      providerOrderId: 'order_abc',
      amount: 71.3,
      currency: 'INR',
    });
    expect(result.order).toBeNull();
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

    expect(prisma.cancellationRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasRefund: false }),
      }),
    );
  });

  it('sets hasRefund to true for a real charged payment method — every order reaching this method was, by construction, actually paid for (Phase 2: an Order only exists once PaymentsService.confirmAndCreateOrder has already run)', async () => {
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

  it('returns an honest "awaiting fulfillment" response — not a fabricated in-transit simulation — for an order with no courier assigned yet (Phase 5)', async () => {
    const { prisma, trackingService, service } = createDeps();
    const placedAt = new Date('2026-01-01T00:00:00Z');
    prisma.order.findFirst = jest.fn().mockResolvedValue({
      createdAt: placedAt,
      deliveryMethod: 'STANDARD',
      shippingAddressSnapshot: { city: 'Bengaluru' },
      courierId: null,
      trackingNumber: null,
      trackingUrl: null,
      shippedAt: null,
      cancellation: null,
      returnRequest: null,
    });

    const result = await service.getTracking('user-1', 'order-1');

    expect(trackingService.simulate).not.toHaveBeenCalled();
    expect(result.courierId).toBeNull();
    expect(result.trackingNumber).toBeNull();
    expect(result.proofOfDelivery).toBeNull();
    expect(result.stages[0]).toEqual(
      expect.objectContaining({
        completed: true,
        timestamp: placedAt.toISOString(),
      }),
    );
    expect(result.stages[1]).toEqual(
      expect.objectContaining({ completed: false }),
    );
  });

  it('seeds the simulation from shippedAt, not order placement, once a real shipment exists', async () => {
    const { prisma, trackingService, service } = createDeps();
    const shippedAt = new Date('2026-01-05T00:00:00Z');
    prisma.order.findFirst = jest.fn().mockResolvedValue({
      createdAt: new Date('2026-01-01T00:00:00Z'),
      deliveryMethod: 'STANDARD',
      shippingAddressSnapshot: { city: 'Bengaluru' },
      courierId: 'Delhivery Surface',
      trackingNumber: 'AWB123456789',
      trackingUrl: 'https://shiprocket.co/tracking/AWB123456789',
      shippedAt,
      cancellation: null,
      returnRequest: null,
    });

    await service.getTracking('user-1', 'order-1');

    expect(trackingService.simulate).toHaveBeenCalledWith(
      expect.objectContaining({
        placedAt: shippedAt,
        courierId: 'Delhivery Surface',
        trackingNumber: 'AWB123456789',
      }),
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

  it("emits NOTIFICATION_EVENTS.ORDER_STATUS_CHANGED with the real order id/userId/new status — Phase 3's real trigger point for the previously-dead-code confirmed/shipped/delivered notifications and emails", async () => {
    const { prisma, service, eventEmitter } = createDeps();
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'SHIPPED',
      userId: 'user-42',
    });
    prisma.order.update.mockResolvedValue({});
    prisma.order.findFirst.mockResolvedValue(makeCreatedOrder());

    await service.adminUpdateStatus('order-1', 'DELIVERED');

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'notification.order_status_changed',
      { orderId: 'order-1', userId: 'user-42', status: 'DELIVERED' },
    );
  });

  it('rejects CONFIRMED -> SHIPPED through this generic endpoint (Phase 5) — that real fulfillment step now requires OrdersService.shipOrder', async () => {
    const { prisma, service } = createDeps();
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      status: 'CONFIRMED',
      userId: 'user-1',
    });

    await expect(
      service.adminUpdateStatus('order-1', 'SHIPPED'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });
});

describe('OrdersService.shipOrder', () => {
  function makeConfirmedOrder(overrides: Record<string, unknown> = {}) {
    return {
      id: 'order-1',
      status: 'CONFIRMED',
      userId: 'user-1',
      total: decimal(71.3),
      paymentMethod: 'COD',
      shippingAddressSnapshot: makeAddress({
        fullName: 'Sam Rivera',
        phone: '555-0100',
        postalCode: '560001',
      }),
      items: [{ name: 'Monstera', quantity: 2, price: decimal(30) }],
      ...overrides,
    };
  }

  it('rejects shipping an order that is not CONFIRMED', async () => {
    const { prisma, service, shippingProvider } = createDeps();
    prisma.order.findUnique.mockResolvedValue(
      makeConfirmedOrder({ status: 'PROCESSING' }),
    );

    await expect(service.shipOrder('order-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(shippingProvider.createShipment).not.toHaveBeenCalled();
  });

  it('creates a real shipment, persists the real courier/AWB/tracking link, and moves the order to SHIPPED', async () => {
    const { prisma, service, shippingProvider } = createDeps();
    prisma.order.findUnique.mockResolvedValue(makeConfirmedOrder());
    prisma.order.update.mockResolvedValue({});
    prisma.order.findFirst.mockResolvedValue(makeCreatedOrder());

    await service.shipOrder('order-1');

    expect(shippingProvider.createShipment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        isCod: true,
        shippingAddress: expect.objectContaining({ pincode: '560001' }),
      }),
    );
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: 'SHIPPED',
        courierId: 'Delhivery Surface',
        trackingNumber: 'AWB123456789',
        trackingUrl: 'https://shiprocket.co/tracking/AWB123456789',
      }),
    });
  });

  it('propagates a real shipping-provider failure without marking the order shipped', async () => {
    const { prisma, service, shippingProvider } = createDeps();
    prisma.order.findUnique.mockResolvedValue(makeConfirmedOrder());
    shippingProvider.createShipment.mockRejectedValue(
      new Error('Shiprocket is not configured'),
    );

    await expect(service.shipOrder('order-1')).rejects.toThrow(
      'Shiprocket is not configured',
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
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
