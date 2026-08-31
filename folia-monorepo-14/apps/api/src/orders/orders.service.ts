/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
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
   * for the same low-stock item.
   */
  async checkout(userId: string, dto: CheckoutDto, idempotencyKey?: string) {
    if (idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
        include: { items: true, cancellation: true, returnRequest: true },
      });
      if (existing)
        return {
          ...toPublicOrder(existing as never),
          isIdempotentReplay: true,
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
    const payment = this.paymentsService.process(
      paymentMethodDb,
      dto.paymentDisplayLabel,
    );

    for (const item of cart.items) {
      await this.inventoryService.decrementForProduct(
        item.productId,
        item.variantId,
        item.quantity,
      );
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
        paymentMethod: payment.method,
        paymentDisplayLabel: payment.displayLabel,
        paymentTransactionId: payment.transactionId,
        courierId,
        trackingNumber,
        customerNotes: dto.customerNotes,
        idempotencyKey: idempotencyKey ?? null,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            slug: item.product.slug,
            name: item.product.name,
            categorySlug: item.product.category.slug,
            variantId: item.variantId,
            variantLabel: item.variant?.label ?? null,
            price: item.unitPrice.toNumber(),
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    await this.cartService.clearCart(cart.id);

    return { ...toPublicOrder(order as never), isIdempotentReplay: false };
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
      include: { cancellation: true },
    });
    if (!order) throw new NotFoundException('Order not found.');

    const typedOrder = order as {
      status: string;
      cancellation: unknown;
      paymentMethod: string;
    };
    if (!canCancelOrder(typedOrder.status, !!typedOrder.cancellation)) {
      throw new BadRequestException('This order can no longer be cancelled.');
    }

    await this.prisma.$transaction([
      this.prisma.cancellationRequest.create({
        data: {
          orderId,
          reason: CANCELLATION_REASON_TO_DB[dto.reason],
          note: dto.note,
          hasRefund: typedOrder.paymentMethod !== 'COD',
        },
      }),
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      }),
    ]);

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
