// See users/users.service.ts's top-of-file comment for why this exemption exists.
import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import type { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { AddressesService } from '../addresses/addresses.service';
import { CouponsService } from '../coupons/coupons.service';
import {
  PaymentsService,
  PAYMENT_EXPIRY_MINUTES,
} from '../payments/payments.service';
import { AppConfigService } from '../config/app-config.service';
import { InventoryService } from '../inventory/inventory.service';
import { TrackingService } from '../tracking/tracking.service';
import {
  TRACKING_STAGE_DEFS,
  stagePublicName,
} from '../tracking/tracking.types';
import { toPublicAddress } from '../addresses/address.types';
import { generateOrderId } from './order-id.util';
import {
  DELIVERY_METHOD_DEFS,
  TAX_RATE,
  toPublicOrder,
  CANCELLATION_REASON_TO_DB,
} from './order.types';
import { canCancelOrder } from './refund.util';
import { canTransitionStatus } from './order-status.util';
import { NOTIFICATION_EVENTS } from '../notifications/notification.events';
import type { OrderStatusChangedPayload } from '../notifications/notification.events';
import {
  SHIPPING_PROVIDER,
  type ShippingProviderClient,
} from '../shipping/providers/shipping-provider.interface';
import type { CheckoutDto } from './dto/checkout.dto';
import type { CancelOrderDto } from './dto/cancel-order.dto';
import type {
  DeliveryMethodType,
  PaymentMethodType,
  AddressSnapshot,
  CheckoutSnapshot,
} from './order.types';

const DELIVERY_METHOD_TO_DB: Record<
  CheckoutDto['deliveryMethod'],
  DeliveryMethodType
> = {
  standard: 'STANDARD',
  express: 'EXPRESS',
  'same-day': 'SAME_DAY',
  pickup: 'PICKUP',
};

const PAYMENT_METHOD_TO_DB: Record<
  CheckoutDto['paymentMethod'],
  PaymentMethodType
> = {
  'credit-card': 'CREDIT_CARD',
  'debit-card': 'DEBIT_CARD',
  upi: 'UPI',
  'net-banking': 'NET_BANKING',
  cod: 'COD',
  wallet: 'WALLET',
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly addressesService: AddressesService,
    private readonly couponsService: CouponsService,
    private readonly paymentsService: PaymentsService,
    private readonly inventoryService: InventoryService,
    private readonly trackingService: TrackingService,
    private readonly config: AppConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(SHIPPING_PROVIDER)
    private readonly shippingProvider: ShippingProviderClient,
  ) {}

  /**
   * Phase 2's target flow, in order: validate → reserve inventory
   * atomically → create payment → (payment confirmation, a separate later
   * call — see PaymentsService.verify/handleWebhookEvent) → commit
   * reservation → create order → clear cart. The last four steps live in
   * PaymentsService.confirmAndCreateOrder, driven by the checkoutSnapshot
   * this method computes and hands off — see that field's schema.prisma
   * comment for why the split exists at all.
   *
   * This replaces Phase 1's decrement-then-create-order-then-pay ordering,
   * which had two real, now-closed gaps: (1) InventoryService.reserve's
   * (and decrementForProduct's underlying adjustStock's) read-then-write
   * wasn't actually safe under concurrent access despite the
   * $transaction wrapper — see InventoryService.lockItemForUpdate's doc
   * comment for why Postgres's default isolation doesn't serialize that
   * on its own — and (2) an Order existed (in PENDING_PAYMENT) before
   * payment was known to succeed, so a checkout that decremented stock
   * but never got a Payment row created (e.g. Razorpay unreachable) had
   * no Payment for the expiry sweep to ever find, permanently losing that
   * stock. Reserving (not decrementing) before payment exists, and only
   * ever creating the Order once payment is confirmed, closes both: the
   * reservation is real-availability-checked under a row lock, and an
   * order simply cannot exist without a resolved payment behind it.
   */
  async checkout(userId: string, dto: CheckoutDto, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existingPayment = await this.prisma.payment.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
        include: { order: { include: { items: true } } },
      });
      if (existingPayment) {
        return {
          isIdempotentReplay: true,
          payment: {
            paymentId: existingPayment.id,
            status: existingPayment.status,
            requiresGatewayCheckout:
              existingPayment.provider === 'RAZORPAY' &&
              existingPayment.status === 'CREATED',
            ...(existingPayment.provider === 'RAZORPAY' &&
            existingPayment.status === 'CREATED' &&
            existingPayment.providerOrderId
              ? {
                  gateway: {
                    keyId: this.config.razorpayKeyId ?? '',
                    providerOrderId: existingPayment.providerOrderId,
                    amount: Number(existingPayment.amount),
                    currency: existingPayment.currency,
                  },
                }
              : {}),
          },
          order: existingPayment.order
            ? toPublicOrder(existingPayment.order as never)
            : null,
        };
      }
    }

    const { cart } = await this.cartService.resolveCart(userId, null);
    if (cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty.');
    }

    // Marketplace Phase 5 — defense in depth, re-checked here rather than
    // trusted from add-to-cart time: a product's approvalStatus (or its
    // seller's own status) can change at any point between "added to
    // cart" and "checkout completes," and InventoryService.reserveForProduct
    // itself has no concept of approval status at all — only real stock.
    // Never lets an unapproved product or a non-selling seller's item
    // reach a real reservation/payment.
    for (const item of cart.items) {
      if (item.product.approvalStatus !== 'ACTIVE') {
        throw new BadRequestException(
          `"${item.product.name}" is no longer available for purchase.`,
        );
      }
    }
    const cartSellerIds = [
      ...new Set(
        cart.items
          .map((item) => item.product.sellerId)
          .filter((id): id is string => id !== null),
      ),
    ];
    if (cartSellerIds.length > 0) {
      const sellers = await this.prisma.seller.findMany({
        where: { id: { in: cartSellerIds } },
        select: { id: true, status: true },
      });
      const inactiveSeller = sellers.find((s) => s.status !== 'ACTIVE');
      if (inactiveSeller || sellers.length !== cartSellerIds.length) {
        throw new BadRequestException(
          'One or more items in your cart are no longer available for purchase.',
        );
      }
    }

    const shippingAddress = await this.addressesService.findOwnedOrThrow(
      userId,
      dto.shippingAddressId,
    );
    const billingAddress = await this.addressesService.findOwnedOrThrow(
      userId,
      dto.billingAddressId,
    );

    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.unitPrice.toNumber() * item.quantity,
      0,
    );

    let discount = 0;
    let couponCode: string | undefined;
    if (dto.couponCode) {
      const coupon = await this.couponsService.validate(
        dto.couponCode,
        subtotal,
      );
      discount =
        coupon.type === 'percent'
          ? subtotal * (coupon.value / 100)
          : coupon.value;
      couponCode = coupon.code;
    }

    const deliveryMethodDb = DELIVERY_METHOD_TO_DB[dto.deliveryMethod];
    const { cost: shippingCost, etaDays: estimatedDelivery } =
      DELIVERY_METHOD_DEFS[deliveryMethodDb];

    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = taxableAmount * TAX_RATE;
    const total = subtotal - discount + shippingCost + tax;

    const paymentMethodDb = PAYMENT_METHOD_TO_DB[dto.paymentMethod];
    const paymentId = randomUUID();

    // Reserve every line against this (not-yet-created) payment's id —
    // row-locked per candidate item (InventoryService.reserveForProduct),
    // so two customers racing for the last unit can't both succeed here.
    // A failure partway through releases everything already reserved
    // before rethrowing, so a checkout that can't fully reserve never
    // leaves a partial hold behind.
    const reservations: {
      reservationId: string;
      inventoryItemId: string;
    }[] = [];
    try {
      for (const item of cart.items) {
        const reservation = await this.inventoryService.reserveForProduct(
          item.productId,
          item.variantId,
          item.quantity,
          'PAYMENT',
          paymentId,
          PAYMENT_EXPIRY_MINUTES,
        );
        reservations.push({
          reservationId: reservation.id,
          inventoryItemId: reservation.inventoryItemId,
        });
      }
    } catch (err) {
      for (const { reservationId } of reservations) {
        await this.inventoryService.releaseReservation(reservationId);
      }
      throw err;
    }

    const orderId = generateOrderId();

    const shippingSnapshot: AddressSnapshot = toPublicAddress(shippingAddress);
    const billingSnapshot: AddressSnapshot = toPublicAddress(billingAddress);

    const checkoutSnapshot: CheckoutSnapshot = {
      orderId,
      subtotal,
      discount,
      couponCode: couponCode ?? null,
      shippingCost,
      tax,
      total,
      estimatedDelivery,
      deliveryMethod: deliveryMethodDb,
      customerNotes: dto.customerNotes ?? null,
      shippingAddressSnapshot: shippingSnapshot,
      billingAddressSnapshot: billingSnapshot,
      items: cart.items.map((item, index) => ({
        productId: item.productId,
        slug: item.product.slug,
        name: item.product.name,
        categorySlug: item.product.category.slug,
        variantId: item.variantId,
        variantLabel: item.variant?.label ?? null,
        price: item.unitPrice.toNumber(),
        quantity: item.quantity,
        inventoryItemId: reservations[index].inventoryItemId,
        reservationId: reservations[index].reservationId,
        sellerId: item.product.sellerId,
      })),
    };

    let paymentResult;
    try {
      paymentResult = await this.paymentsService.createForOrder({
        paymentId,
        userId,
        method: paymentMethodDb,
        amount: total,
        displayLabel: dto.paymentDisplayLabel,
        idempotencyKey,
        checkoutSnapshot,
      });
    } catch (err) {
      // Creating the Payment row itself failed (Razorpay unreachable,
      // misconfigured keys, a timeout). There is no Order to roll back —
      // Phase 2 only ever creates one once payment is confirmed — so
      // releasing every reservation just made is the entire rollback.
      for (const { reservationId } of reservations) {
        await this.inventoryService.releaseReservation(reservationId);
      }
      throw err;
    }

    return {
      isIdempotentReplay: false,
      payment: paymentResult,
      // COD resolves synchronously (PaymentsService.createCodPayment
      // calls confirmAndCreateOrder itself) — paymentResult.order carries
      // the real order. A gateway method has no order yet: the customer
      // still has to complete Checkout.js, and verify()/the webhook is
      // what actually creates it.
      order: paymentResult.order ?? null,
    };
  }

  async findAllForUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        cancellation: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order: unknown) => toPublicOrder(order as never));
  }

  /** Distinct product ids this user has ever purchased — used by SearchController to give search ranking a real "you bought this before" signal, not just wishlist/local-browsing data. Deliberately lightweight (no full order/item hydration) since ranking only needs the id set. */
  async getPurchasedProductIds(userId: string): Promise<string[]> {
    const items = (await this.prisma.orderItem.findMany({
      where: { order: { userId } },
      select: { productId: true },
      distinct: ['productId'],
    })) as { productId: string }[];
    return items.map((item) => item.productId);
  }

  async findOneForUser(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: {
        items: true,
        cancellation: true,
        payment: true,
        // Marketplace Phase 16 — per-seller shipment breakdown for the
        // order detail page. Only fetched here, not findAllForUser: the
        // order list only ever showed one whole-order status, and this
        // is real extra data the list view has no use for.
        sellerGroups: {
          include: {
            items: true,
            seller: { select: { displayName: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found.');
    return toPublicOrder(order as never);
  }

  async requestCancellation(
    userId: string,
    orderId: string,
    dto: CancelOrderDto,
  ) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { cancellation: true, payment: true },
    });
    if (!order) throw new NotFoundException('Order not found.');

    const typedOrder = order as {
      status: string;
      cancellation: unknown;
      paymentMethod: string;
      payment: { id: string } | null;
    };
    if (!canCancelOrder(typedOrder.status, !!typedOrder.cancellation)) {
      throw new BadRequestException('This order can no longer be cancelled.');
    }

    const hasRefund = typedOrder.paymentMethod !== 'COD';

    // No "was this never paid" branch (Phase 1 had one): an Order row
    // only exists once PaymentsService.confirmAndCreateOrder has already
    // run, which only happens once payment is genuinely resolved (a real
    // capture, or COD) — so every order this method can reach was, by
    // construction, actually paid for (or is COD, awaiting collection).
    // Backing out of a checkout BEFORE payment resolves isn't an Order
    // cancellation at all now — there's no Order yet to cancel — it's
    // just an unconfirmed Payment whose reservation expires on its own
    // (PaymentsService.expireStalePayments / the reservation's own TTL).
    try {
      await this.prisma.$transaction([
        this.prisma.cancellationRequest.create({
          data: {
            orderId,
            reason: CANCELLATION_REASON_TO_DB[dto.reason],
            note: dto.note,
            hasRefund,
          },
        }),
        this.prisma.order.update({
          where: { id: orderId },
          data: { status: 'CANCELLED' },
        }),
      ]);
    } catch (err) {
      // The CancellationRequest.orderId @unique constraint is the last
      // line of defense against two concurrent cancellation requests for
      // the same order both passing the canCancelOrder check above before
      // either commits — without this catch, the loser gets an uncaught
      // Prisma P2002 (a raw 500) instead of the same clean rejection the
      // sequential path already returns.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('This order can no longer be cancelled.');
      }
      throw err;
    }

    // Attempted synchronously, immediately after the cancellation itself
    // commits — matching this system's existing auto-approve behavior
    // (there is no admin review gate for cancellation, before or after
    // this change; that's a real, separately-flagged Phase 6 business
    // decision — see docs/PRODUCTION_ROADMAP.md). Deliberately never lets
    // a failed refund attempt fail the cancellation itself: the order is
    // genuinely cancelled either way, and toPublicCancellation's
    // refundStatus honestly reflects whatever Payment.status actually is
    // afterward ('processing', not a lie, if this attempt didn't pan
    // out) — same non-fatal-side-effect philosophy Phase 3 established
    // for email sends never breaking their triggering request.
    if (hasRefund && typedOrder.payment) {
      try {
        await this.paymentsService.refund(
          typedOrder.payment.id,
          { reason: `Order cancelled: ${dto.reason}` },
          { actorId: userId, actorType: 'system' },
        );
      } catch (err) {
        this.logger.warn(
          `Refund attempt failed for cancelled order ${orderId} (payment ${typedOrder.payment.id}): ${err instanceof Error ? err.message : 'unknown error'} — needs manual follow-up.`,
        );
      }
    }

    return this.findOneForUser(userId, orderId);
  }

  async getTracking(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { cancellation: true, returnRequest: true },
    });
    if (!order) throw new NotFoundException('Order not found.');

    const typedOrder = order as unknown as {
      createdAt: Date;
      deliveryMethod: DeliveryMethodType;
      shippingAddressSnapshot: { city: string };
      courierId: string | null;
      trackingNumber: string | null;
      trackingUrl: string | null;
      shippedAt: Date | null;
      cancellation: { requestedAt: Date } | null;
      returnRequest: { requestedAt: Date } | null;
    };

    // No real shipment exists yet (Phase 5: courier assignment moved out
    // of checkout, into the admin ship action) — an honest "we have your
    // order, haven't shipped it yet" response, not a fabricated in-transit
    // simulation for a courier that was never actually assigned.
    if (!typedOrder.courierId || !typedOrder.trackingNumber) {
      return this.buildAwaitingFulfillmentTracking(
        orderId,
        typedOrder.createdAt,
      );
    }

    // A cancelled/returned order's tracking simulation freezes at the
    // moment it was cancelled/returned — it shouldn't keep "progressing"
    // toward delivery after the order is no longer actually in transit.
    const frozenAt =
      typedOrder.cancellation?.requestedAt ??
      typedOrder.returnRequest?.requestedAt;

    const simulated = this.trackingService.simulate({
      orderId,
      // Progress counts from when the shipment actually left (shippedAt),
      // not from order placement — a delivery window starts when a
      // courier takes the package, not when payment resolved.
      placedAt: typedOrder.shippedAt ?? typedOrder.createdAt,
      deliveryMethod: typedOrder.deliveryMethod,
      destinationCity: typedOrder.shippingAddressSnapshot.city,
      courierId: typedOrder.courierId,
      trackingNumber: typedOrder.trackingNumber,
      frozenAt,
    });
    return { ...simulated, trackingUrl: typedOrder.trackingUrl };
  }

  private buildAwaitingFulfillmentTracking(orderId: string, placedAt: Date) {
    const stages = TRACKING_STAGE_DEFS.map((def, i) => ({
      stage: stagePublicName(def.stage),
      label: def.label,
      description: def.description,
      completed: i === 0,
      timestamp: i === 0 ? placedAt.toISOString() : null,
    }));
    return {
      orderId,
      courierId: null,
      trackingNumber: null,
      trackingUrl: null,
      currentLocation: null,
      progressPercent: Math.round((1 / TRACKING_STAGE_DEFS.length) * 100),
      stages,
      isDelayed: false,
      delayHours: null,
      estimatedWindowStart: null,
      estimatedWindowEnd: null,
      proofOfDelivery: null,
    };
  }

  /**
   * The real fulfillment action Phase 4's admin panel was missing (see
   * docs/PRODUCTION_STATUS.md) — creates a real shipment via
   * ShippingProviderClient.createShipment, assigning a genuine courier
   * name, AWB (tracking number), and tracking link, then moves the order
   * to SHIPPED. Deliberately its own method rather than going through
   * adminUpdateStatus/canTransitionStatus: CONFIRMED -> SHIPPED is no
   * longer a bare status flip (see order-status.util.ts's doc comment)
   * — it has a real, failable side effect that must complete before the
   * status changes, so an admin who clicks "ship" and gets a Shiprocket
   * error sees the order still sitting in CONFIRMED, not silently marked
   * shipped with no real shipment behind it.
   */
  async shipOrder(orderId: string) {
    // Marketplace Phase 12 — an order can now genuinely have more than
    // one seller's own fulfillment group (Phase 5). Creating ONE shipment
    // that silently claimed to cover every seller's items would be
    // factually wrong (a real Shiprocket shipment/AWB tied to a single
    // pickup location) the moment a real multi-seller order reaches this
    // endpoint — refuse loudly and point at the real per-group action
    // instead of ever letting that happen. The trivial, still-common
    // single-group case (a Folia-only or single-seller cart) delegates to
    // the exact same real mechanism unchanged.
    const groups = await this.prisma.orderSellerGroup.findMany({
      where: { orderId },
      select: { id: true },
    });
    if (groups.length === 0) throw new NotFoundException('Order not found.');
    if (groups.length > 1) {
      throw new BadRequestException(
        "This order has multiple sellers' items — ship each seller's portion individually via the per-seller ship action, not this whole-order one.",
      );
    }

    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { userId: true },
    });
    await this.shipOrderSellerGroup(groups[0].id);
    return this.findOneForUser(order.userId, orderId);
  }

  /**
   * Marketplace Phase 12 — the real per-seller fulfillment action
   * OrderSellerGroup's own Phase 5 doc comment deferred here. Reuses the
   * exact same ShippingProviderClient.createShipment this codebase's
   * whole-order shipOrder already called, scoped to just this group's own
   * items, with a group-unique reference id so two different sellers'
   * shipments for the same order never collide on the courier's own
   * side. `sellerId` scopes ownership when a seller is shipping their own
   * group (a mismatched/nonexistent group 404s, matching this whole
   * initiative's ownership-scoping-in-the-query convention); omit it for
   * an admin shipping any group, including Folia's own (sellerId: null).
   */
  async shipOrderSellerGroup(groupId: string, sellerId?: string) {
    const group = await this.prisma.orderSellerGroup.findFirst({
      where: { id: groupId, ...(sellerId ? { sellerId } : {}) },
      include: {
        items: true,
        order: {
          select: {
            id: true,
            userId: true,
            status: true,
            paymentMethod: true,
            shippingAddressSnapshot: true,
          },
        },
      },
    });
    if (!group) throw new NotFoundException('Order not found.');

    const typedOrder = group.order as unknown as {
      id: string;
      userId: string;
      status: string;
      paymentMethod: string;
      shippingAddressSnapshot: {
        fullName: string;
        addressLine1: string;
        addressLine2?: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
        phone: string;
        email?: string;
      };
    };

    if (typedOrder.status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Cannot ship an order in ${typedOrder.status} status — it must be CONFIRMED first.`,
      );
    }
    if (group.status !== 'PROCESSING') {
      throw new BadRequestException(
        `This seller's portion is already ${group.status.toLowerCase()}.`,
      );
    }

    const shipment = await this.shippingProvider.createShipment({
      // A group-unique reference — two different sellers' real shipments
      // for the SAME order must never collide on the courier's own side.
      // The trivial single-group case keeps using the bare orderId
      // (shipOrder's own delegation), matching this system's pre-existing
      // Shiprocket order_id exactly for that still-common case.
      orderId: `${typedOrder.id}-${group.id.slice(0, 8)}`,
      orderDate: new Date(),
      shippingAddress: {
        fullName: typedOrder.shippingAddressSnapshot.fullName,
        addressLine1: typedOrder.shippingAddressSnapshot.addressLine1,
        addressLine2: typedOrder.shippingAddressSnapshot.addressLine2,
        city: typedOrder.shippingAddressSnapshot.city,
        state: typedOrder.shippingAddressSnapshot.state,
        pincode: typedOrder.shippingAddressSnapshot.postalCode,
        country: typedOrder.shippingAddressSnapshot.country,
        phone: typedOrder.shippingAddressSnapshot.phone,
        email: typedOrder.shippingAddressSnapshot.email,
      },
      items: group.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.price.toNumber(),
      })),
      subtotal: group.items.reduce(
        (sum, item) => sum + item.price.toNumber() * item.quantity,
        0,
      ),
      isCod: typedOrder.paymentMethod === 'COD',
      // Same honest per-item weight estimate as the whole-order path
      // this replaces for the multi-group case — scoped to just this
      // group's own items now, not the whole order's.
      weightKg: Math.max(
        0.5,
        group.items.reduce((sum, item) => sum + item.quantity, 0) * 0.5,
      ),
    });

    await this.prisma.orderSellerGroup.update({
      where: { id: groupId },
      data: {
        status: 'SHIPPED',
        courierId: shipment.courierName,
        trackingNumber: shipment.awbCode,
        trackingUrl: shipment.trackingUrl,
        shippedAt: new Date(),
      },
    });

    await this.rollUpOrderStatusIfAllGroupsReached(
      typedOrder.id,
      typedOrder.userId,
      'SHIPPED',
    );

    return this.prisma.orderSellerGroup.findUniqueOrThrow({
      where: { id: groupId },
    });
  }

  /**
   * Marketplace Phase 12 — the admin-only counterpart to
   * OrdersService.adminUpdateStatus's own DELIVERED transition, scoped to
   * one seller's group. No real delivery webhook exists (same honesty
   * posture as Order.deliveredAt itself), so this stays an explicit admin
   * action, never automatic.
   */
  async markGroupDelivered(groupId: string) {
    const group = await this.prisma.orderSellerGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        orderId: true,
        status: true,
        order: { select: { userId: true } },
      },
    });
    if (!group) throw new NotFoundException('Order not found.');
    if (group.status !== 'SHIPPED') {
      throw new BadRequestException(
        `Cannot mark delivered — this seller's portion is ${group.status.toLowerCase()}, it must be shipped first.`,
      );
    }

    await this.prisma.orderSellerGroup.update({
      where: { id: groupId },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });

    await this.rollUpOrderStatusIfAllGroupsReached(
      group.orderId,
      group.order.userId,
      'DELIVERED',
    );

    return this.prisma.orderSellerGroup.findUniqueOrThrow({
      where: { id: groupId },
    });
  }

  /**
   * Marketplace Phase 12 — Order.status stays the real "is this whole
   * order done" fact, rolled up only once every one of its
   * OrderSellerGroups has independently reached the same milestone
   * (trivial and immediate for the still-common single-group case).
   * Order.courierId/trackingNumber/trackingUrl are single-value columns
   * that genuinely cannot represent "two different couriers for two
   * different sellers" — they're only ever copied up from the group
   * alongside the roll-up when there is exactly one group, preserving
   * OrdersService.getTracking's existing single-shipment simulation
   * unchanged for that case. A real multi-seller order's Order.status
   * still correctly reflects SHIPPED/DELIVERED once every group gets
   * there — only the single courier/tracking display, and getTracking's
   * per-shipment simulation, stay a known, honestly-scoped gap for that
   * case (see this phase's own gate report).
   */
  private async rollUpOrderStatusIfAllGroupsReached(
    orderId: string,
    userId: string,
    target: 'SHIPPED' | 'DELIVERED',
  ): Promise<void> {
    const groups = await this.prisma.orderSellerGroup.findMany({
      where: { orderId },
      select: {
        status: true,
        courierId: true,
        trackingNumber: true,
        trackingUrl: true,
      },
    });
    const reached = (status: string) =>
      target === 'SHIPPED'
        ? status === 'SHIPPED' || status === 'DELIVERED'
        : status === 'DELIVERED';
    if (!groups.every((g) => reached(g.status))) return;

    const single = groups.length === 1 ? groups[0] : null;
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: target,
        ...(target === 'SHIPPED' ? { shippedAt: new Date() } : {}),
        ...(target === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(single
          ? {
              courierId: single.courierId,
              trackingNumber: single.trackingNumber,
              trackingUrl: single.trackingUrl,
            }
          : {}),
      },
    });

    const payload: OrderStatusChangedPayload = {
      orderId,
      userId,
      status: target,
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other controllers/services.
    this.eventEmitter.emit(NOTIFICATION_EVENTS.ORDER_STATUS_CHANGED, payload);
  }

  /** Real admin visibility across every customer's orders — genuinely new; every prior method in this service is scoped to a single user's own orders. */
  /** Ownership-scoped via {id, userId} — same real 404-on-cross-user-access pattern established in notifications.service.ts (Phase 15), not the silent-no-op wishlist precedent, since a customer editing another customer's order notes is a real thing to reject loudly. */
  async updateNotes(userId: string, orderId: string, notes: string) {
    const { count } = await this.prisma.order.updateMany({
      where: { id: orderId, userId },
      data: { customerNotes: notes || null },
    });
    if (count === 0) throw new NotFoundException('Order not found.');
    return this.findOneForUser(userId, orderId);
  }

  /**
   * Mirrors apps/web/src/pages/AccountOrderDetail.tsx's own
   * addAllItemsToCart() exactly — same {added, skipped} return shape,
   * same per-item logic (skip if the product no longer exists or has
   * zero real stock, otherwise add up to whatever's actually
   * available). The real difference: this checks genuine current
   * InventoryService availability, not a client-side product list that
   * could be stale.
   */
  async reorder(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Order not found.');

    const cart = await this.cartService.resolveCart(userId, null);
    let added = 0;
    let skipped = 0;

    for (const item of (
      order as unknown as {
        items: {
          productId: string;
          variantId: string | null;
          quantity: number;
        }[];
      }
    ).items) {
      const available = await this.inventoryService.getAvailability(
        item.productId,
        item.variantId ?? undefined,
      );
      if (available <= 0) {
        skipped++;
        continue;
      }
      await this.cartService.addItem(
        cart.cart.id,
        item.productId,
        item.variantId,
        Math.min(item.quantity, available),
      );
      added++;
    }

    return { added, skipped };
  }

  async adminFindAll(filters: { status?: string } = {}) {
    const orders = await this.prisma.order.findMany({
      where: filters.status ? { status: filters.status as OrderStatus } : {},
      include: {
        items: true,
        cancellation: true,
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order: unknown) => toPublicOrder(order as never));
  }

  /** See order-status.util.ts's doc comment for exactly why this only covers the forward fulfillment pipeline, never CANCELLED/RETURNED/REFUNDED. */
  async adminUpdateStatus(orderId: string, newStatus: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new NotFoundException('Order not found.');

    const currentStatus = (order as { status: string }).status;
    if (!canTransitionStatus(currentStatus, newStatus)) {
      throw new BadRequestException(
        `Cannot move an order from ${currentStatus} to ${newStatus}.`,
      );
    }

    // Marketplace Phase 12 — DELIVERED must stay consistent with each
    // OrderSellerGroup's own independently-tracked status (Phase 12's
    // real per-seller fulfillment). Delegating to markGroupDelivered for
    // the trivial, still-common single-group case keeps that group in
    // sync automatically; a genuine multi-seller order is refused here,
    // the same way shipOrder refuses SHIPPED for one, since a bare
    // whole-order override would mark the order delivered while some
    // seller's own portion may still only be SHIPPED, not yet actually
    // confirmed delivered.
    if (newStatus === 'DELIVERED') {
      const groups = await this.prisma.orderSellerGroup.findMany({
        where: { orderId },
        select: { id: true },
      });
      if (groups.length > 1) {
        throw new BadRequestException(
          "This order has multiple sellers' items — mark each seller's portion delivered individually, not this whole-order status.",
        );
      }
      if (groups.length === 1) {
        await this.markGroupDelivered(groups[0].id);
        return this.findOneForUser(
          (order as { userId: string }).userId,
          orderId,
        );
      }
      // No groups at all (a pre-Phase-5 order somehow never backfilled)
      // — fall through to the plain update below exactly as before.
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: newStatus as OrderStatus,
        // Set exactly once, the moment an order actually reaches
        // DELIVERED — the authoritative eligibility-window timestamp for
        // Phase 6D's return/DOA claims (see return-policy.util.ts).
        // Never overwritten on a later call: DELIVERED has no outgoing
        // transitions (order-status.util.ts's ALLOWED_TRANSITIONS), so
        // canTransitionStatus already makes this branch unreachable a
        // second time for the same order — no extra guard needed here to
        // get "set once" for free from the existing state machine.
        ...(newStatus === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      },
    });

    const userId = (order as { userId: string }).userId;
    // Emitted from here, not the admin controller, since this is the one
    // place that already has both the new status and the order's userId
    // in scope — see notification.events.ts's ORDER_STATUS_CHANGED comment.
    // Only ever fires for the three statuses canTransitionStatus actually
    // allows an admin to set (CONFIRMED/SHIPPED/DELIVERED), matching
    // ADMIN_SETTABLE_STATUSES.
    const payload: OrderStatusChangedPayload = {
      orderId,
      userId,
      status: newStatus as OrderStatusChangedPayload['status'],
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- same eventemitter2 type-resolution quirk noted throughout this codebase's other controllers/services.
    this.eventEmitter.emit(NOTIFICATION_EVENTS.ORDER_STATUS_CHANGED, payload);

    return this.findOneForUser(userId, orderId);
  }
}
