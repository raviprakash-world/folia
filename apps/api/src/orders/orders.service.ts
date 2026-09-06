// See users/users.service.ts's top-of-file comment for why this exemption exists.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CartService } from '../cart/cart.service';
import { AddressesService } from '../addresses/addresses.service';
import { CouponsService } from '../coupons/coupons.service';
import { PaymentsService } from '../payments/payments.service';
import { AppConfigService } from '../config/app-config.service';
import { InventoryService } from '../inventory/inventory.service';
import { TrackingService } from '../tracking/tracking.service';
import { toPublicAddress } from '../addresses/address.types';
import {
  assignCourier,
  generateOrderId,
  generateTrackingNumber,
} from './order-id.util';
import {
  DELIVERY_METHOD_DEFS,
  TAX_RATE,
  toPublicOrder,
  courierIdToPublicName,
  CANCELLATION_REASON_TO_DB,
  RETURN_REASON_TO_DB,
} from './order.types';
import { canCancelOrder, canReturnOrder } from './refund.util';
import { canTransitionStatus } from './order-status.util';
import type { CheckoutDto } from './dto/checkout.dto';
import type { CancelOrderDto } from './dto/cancel-order.dto';
import type { ReturnOrderDto } from './dto/return-order.dto';
import type {
  DeliveryMethodType,
  PaymentMethodType,
  AddressSnapshot,
  CourierIdDb,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly addressesService: AddressesService,
    private readonly couponsService: CouponsService,
    private readonly paymentsService: PaymentsService,
    private readonly inventoryService: InventoryService,
    private readonly trackingService: TrackingService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * KNOWN LIMITATION, stated plainly rather than hidden: inventory is
   * decremented one cart line at a time (InventoryService.decrementForProduct,
   * each its own transaction), not as a single atomic group covering the
   * whole order. A failure partway through the loop (line 3 of 5 out of
   * stock, say) would leave lines 1–2 already decremented with no
   * automatic rollback — a genuine gap a production system would close
   * with a proper saga/compensation pattern or a single shared
   * transaction threaded through every service involved (Cart, Address,
   * Inventory, Order creation), which multiple already-independent
   * services in this codebase don't currently support passing a shared
   * transaction client through. The mitigation actually implemented:
   * availability for every line is checked up front, before payment is
   * even attempted, so the common case (stock genuinely insufficient) is
   * caught and rejected before anything is charged or decremented. This
   * does not close a genuine race between that check and the later
   * decrement — a real, if narrow, TOCTOU gap under concurrent checkouts
   * for the same low-stock item. Phase 2 (inventory concurrency + atomic
   * checkout) is where this gets fixed for real, by routing through the
   * existing reserve()/commitReservation() pair instead — deliberately
   * not touched here, since Phase 1's scope is payments, not inventory
   * locking.
   *
   * Phase 1 (payments) changed what happens after inventory is
   * decremented: this method no longer decides success/failure itself
   * (that was the old Math.random() mock) — it creates the Order in
   * PENDING_PAYMENT (or, for COD, PaymentsService immediately flips it to
   * PROCESSING, since COD has nothing to wait for) and hands off to
   * PaymentsService.createForOrder. The cart is no longer cleared here
   * either, for the same reason: clearing it before a gateway payment is
   * even attempted would empty a customer's cart for an order that might
   * never actually get paid for. PaymentsService clears it once payment
   * genuinely resolves (COD: immediately; gateway: on capture).
   */
  async checkout(userId: string, dto: CheckoutDto, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
        include: {
          items: true,
          cancellation: true,
          returnRequest: true,
          payment: true,
        },
      });
      if (existing)
        return {
          ...toPublicOrder(existing as never),
          isIdempotentReplay: true,
          payment: existing.payment
            ? {
                paymentId: existing.payment.id,
                status: existing.payment.status,
                requiresGatewayCheckout:
                  existing.payment.provider === 'RAZORPAY' &&
                  existing.payment.status === 'CREATED',
                ...(existing.payment.provider === 'RAZORPAY' &&
                existing.payment.status === 'CREATED' &&
                existing.payment.providerOrderId
                  ? {
                      gateway: {
                        keyId: this.config.razorpayKeyId ?? '',
                        providerOrderId: existing.payment.providerOrderId,
                        amount: Number(existing.payment.amount),
                        currency: existing.payment.currency,
                      },
                    }
                  : {}),
              }
            : null,
        };
    }

    const { cart } = await this.cartService.resolveCart(userId, null);
    if (cart.items.length === 0) {
      throw new BadRequestException('Your cart is empty.');
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

    // Pre-check every line's availability BEFORE charging payment or
    // decrementing anything — see this method's doc comment for exactly
    // what this does and doesn't guarantee.
    for (const item of cart.items) {
      const available = await this.inventoryService.getAvailability(
        item.productId,
        item.variantId ?? undefined,
      );
      if (available < item.quantity) {
        throw new BadRequestException(
          `"${item.product.name}" no longer has enough stock (requested ${item.quantity}, ${available} available).`,
        );
      }
    }

    const paymentMethodDb = PAYMENT_METHOD_TO_DB[dto.paymentMethod];
    const isCod = paymentMethodDb === 'COD';

    // Decrement each line, remembering exactly which inventory item it
    // came from — PaymentsService.expireStalePayments needs this to
    // restore stock precisely if this order's payment never completes
    // (see that method's doc comment). Still one-decrement-per-line, not
    // one shared transaction — see this method's doc comment above.
    const decrementedItemIds: string[] = [];
    const decremented: { inventoryItemId: string; quantity: number }[] = [];
    for (const item of cart.items) {
      const inventoryItemId = await this.inventoryService.decrementForProduct(
        item.productId,
        item.variantId,
        item.quantity,
      );
      decrementedItemIds.push(inventoryItemId);
      decremented.push({ inventoryItemId, quantity: item.quantity });
    }

    const orderId = generateOrderId();
    const courierId = assignCourier(orderId);
    const trackingNumber = generateTrackingNumber(orderId, courierId);

    const shippingSnapshot: AddressSnapshot = toPublicAddress(shippingAddress);
    const billingSnapshot: AddressSnapshot = toPublicAddress(billingAddress);

    const order = await this.prisma.order.create({
      data: {
        id: orderId,
        userId,
        subtotal,
        discount,
        couponCode,
        shippingCost,
        tax,
        total,
        shippingAddressSnapshot:
          shippingSnapshot as unknown as Prisma.InputJsonValue,
        billingAddressSnapshot:
          billingSnapshot as unknown as Prisma.InputJsonValue,
        deliveryMethod: deliveryMethodDb,
        estimatedDelivery,
        // status starts PENDING_PAYMENT for a real gateway method — a
        // customer hasn't paid yet, and PaymentsService flips this once
        // they do (or the expiry sweep cancels it if they never do). COD
        // skips straight to PROCESSING inside
        // PaymentsService.createForOrder, since there's no gateway
        // authorization to wait for.
        status: isCod ? 'PROCESSING' : 'PENDING_PAYMENT',
        paymentMethod: paymentMethodDb,
        // paymentDisplayLabel/paymentTransactionId stay unset here — both
        // are populated by PaymentsService once payment actually resolves.
        courierId,
        trackingNumber,
        customerNotes: dto.customerNotes,
        idempotencyKey: idempotencyKey ?? null,
        items: {
          create: cart.items.map((item, index) => ({
            productId: item.productId,
            slug: item.product.slug,
            name: item.product.name,
            categorySlug: item.product.category.slug,
            variantId: item.variantId,
            variantLabel: item.variant?.label ?? null,
            price: item.unitPrice.toNumber(),
            quantity: item.quantity,
            inventoryItemId: decrementedItemIds[index],
          })),
        },
      },
      include: { items: true },
    });

    let paymentResult;
    try {
      paymentResult = await this.paymentsService.createForOrder({
        orderId: order.id,
        userId,
        method: paymentMethodDb,
        amount: total,
        displayLabel: dto.paymentDisplayLabel,
      });
    } catch (err) {
      // Real gap this closes, found by actually running this end-to-end
      // against a live database rather than trusting the unit tests
      // alone: the order and its inventory decrement above are already
      // committed by this point. If creating the gateway payment itself
      // fails (Razorpay unreachable, misconfigured keys, a timeout — see
      // PaymentsService.createGatewayPayment), there is no Payment row
      // for expireStalePayments to ever find, so that safety-net sweep
      // can't rescue this order — it would sit in PENDING_PAYMENT with
      // its stock gone forever. This is a synchronous rollback for a
      // synchronous, immediately-known failure, not a substitute for
      // that sweep (which still exists for the customer-abandons-payment
      // case, where a real Payment row genuinely does exist).
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });
      for (const { inventoryItemId, quantity } of decremented) {
        await this.inventoryService.restoreQuantity(inventoryItemId, quantity);
      }
      throw err;
    }

    // COD resolved synchronously above (order flipped to PROCESSING,
    // paymentTransactionId/displayLabel set, cart cleared) — re-read so
    // the response reflects that instead of the pre-payment snapshot.
    // Gateway methods stay as originally created (PENDING_PAYMENT, no
    // payment fields yet) until the customer actually completes checkout.
    const finalOrder = isCod
      ? await this.prisma.order.findUniqueOrThrow({
          where: { id: order.id },
          include: { items: true },
        })
      : order;

    return {
      ...toPublicOrder(finalOrder as never),
      isIdempotentReplay: false,
      payment: paymentResult,
    };
  }

  async findAllForUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: { items: true, cancellation: true, returnRequest: true },
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
      include: { items: true, cancellation: true, returnRequest: true },
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
      include: { cancellation: true, items: true },
    });
    if (!order) throw new NotFoundException('Order not found.');

    const typedOrder = order as {
      status: string;
      cancellation: unknown;
      paymentMethod: string;
      items: { inventoryItemId: string | null; quantity: number }[];
    };
    if (!canCancelOrder(typedOrder.status, !!typedOrder.cancellation)) {
      throw new BadRequestException('This order can no longer be cancelled.');
    }

    // A PENDING_PAYMENT order (Phase 1) was never actually paid for —
    // nothing was captured, so there is nothing to refund, unlike
    // cancelling an order that already reached PROCESSING via a real
    // capture or COD. Distinct from the general "was this COD" check
    // below, which is about method, not about whether payment ever
    // resolved at all.
    const wasNeverPaid = typedOrder.status === 'PENDING_PAYMENT';

    await this.prisma.$transaction([
      this.prisma.cancellationRequest.create({
        data: {
          orderId,
          reason: CANCELLATION_REASON_TO_DB[dto.reason],
          note: dto.note,
          hasRefund: !wasNeverPaid && typedOrder.paymentMethod !== 'COD',
        },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      }),
    ]);

    if (wasNeverPaid) {
      // Mirrors PaymentsService.expireStalePayments — cancelling before
      // payment ever completed must give the stock back for the same
      // reason letting it sit forever would be wrong there. Payment
      // itself is closed out via the same service so retry() correctly
      // refuses a cancelled order.
      await this.paymentsService.cancelForOrder(orderId);
      for (const item of typedOrder.items) {
        if (item.inventoryItemId) {
          await this.inventoryService.restoreQuantity(
            item.inventoryItemId,
            item.quantity,
          );
        }
      }
    }

    return this.findOneForUser(userId, orderId);
  }

  async requestReturn(userId: string, orderId: string, dto: ReturnOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { returnRequest: true },
    });
    if (!order) throw new NotFoundException('Order not found.');

    const typedOrder = order as {
      status: string;
      returnRequest: unknown;
      createdAt: Date;
    };
    if (
      !canReturnOrder(
        typedOrder.status,
        !!typedOrder.returnRequest,
        typedOrder.createdAt,
      )
    ) {
      throw new BadRequestException('This order is not eligible for a return.');
    }

    await this.prisma.$transaction([
      this.prisma.returnRequest.create({
        data: {
          orderId,
          reason: RETURN_REASON_TO_DB[dto.reason],
          note: dto.note,
        },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'RETURNED' },
      }),
    ]);

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
      courierId: string;
      trackingNumber: string;
      cancellation: { requestedAt: Date } | null;
      returnRequest: { requestedAt: Date } | null;
    };

    // A cancelled/returned order's tracking simulation freezes at the
    // moment it was cancelled/returned — it shouldn't keep "progressing"
    // toward delivery after the order is no longer actually in transit.
    const frozenAt =
      typedOrder.cancellation?.requestedAt ??
      typedOrder.returnRequest?.requestedAt;

    return this.trackingService.simulate({
      orderId,
      placedAt: typedOrder.createdAt,
      deliveryMethod: typedOrder.deliveryMethod,
      destinationCity: typedOrder.shippingAddressSnapshot.city,
      courierId: courierIdToPublicName(typedOrder.courierId as CourierIdDb),
      trackingNumber: typedOrder.trackingNumber,
      frozenAt,
    });
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
      include: { items: true, cancellation: true, returnRequest: true },
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

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus as OrderStatus },
    });
    return this.findOneForUser((order as { userId: string }).userId, orderId);
  }
}
