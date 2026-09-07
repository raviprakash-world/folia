import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_EVENTS } from './notification.events';
import type {
  OrderCancelledPayload,
  OrderReturnRequestedPayload,
  OrderStatusChangedPayload,
  ReturnApprovedPayload,
  ReturnRejectedPayload,
  StoreCreditIssuedPayload,
  ReplacementIssuedPayload,
  ProfileUpdatedPayload,
  PasswordChangedPayload,
  SellerAppliedPayload,
  SellerApprovedPayload,
  SellerRejectedPayload,
  SellerSuspendedPayload,
  SellerReactivatedPayload,
  SellerDeactivatedPayload,
  ProductSubmittedPayload,
  ProductApprovedPayload,
  ProductRejectedPayload,
  ProductDeactivatedPayload,
  SellerPayoutPaidPayload,
} from './notification.events';
import { ANALYTICS_EVENTS } from '../analytics/analytics.events';
import type { OrderCreatedPayload } from '../analytics/analytics.events';
import { PAYMENT_EVENTS } from '../payments/payments.events';
import type { PaymentRefundedPayload } from '../payments/payments.events';

/**
 * The listening half of the event-driven notification pattern — same
 * shape as AnalyticsEventListener. Reuses ANALYTICS_EVENTS.ORDER_CREATED
 * directly (a real, already-emitted occurrence — Phase 8) rather than
 * having OrdersController emit a second, redundant event for the same
 * checkout. Originally scoped to only order placed/cancelled/return-
 * requested, with confirmed/shipped/delivered left out as "no real
 * trigger anywhere in this system to fire them from" — Phase 3 closes
 * that gap by emitting NOTIFICATION_EVENTS.ORDER_STATUS_CHANGED from
 * OrdersService.adminUpdateStatus, the real trigger point that already
 * existed but nothing was listening to.
 */
@Injectable()
export class NotificationEventListener {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Marketplace Phase 18 — the four PRODUCT_* payloads below carry only
   * sellerId (Phase 3's own payload shape, set before this listener
   * existed to consume it), not the seller's userId a Notification row
   * needs. Every other event this listener handles already carries
   * userId directly in its payload; this is the one small enrichment
   * lookup needed to close that gap without reopening Phase 3's own
   * emission call sites just to add a field only this listener needs.
   */
  private async resolveSellerUserId(sellerId: string): Promise<string> {
    const seller = await this.prisma.seller.findUniqueOrThrow({
      where: { id: sellerId },
      select: { userId: true },
    });
    return seller.userId;
  }

  @OnEvent(ANALYTICS_EVENTS.ORDER_CREATED)
  async handleOrderCreated(payload: OrderCreatedPayload): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'ORDER',
      title: 'Order Placed',
      message: `Order ${payload.orderId} was placed successfully.`,
      href: `/account/orders/${payload.orderId}`,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.ORDER_CANCELLED)
  async handleOrderCancelled(payload: OrderCancelledPayload): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'ORDER',
      title: 'Order Cancelled',
      message: `Order ${payload.orderId} was cancelled.`,
      href: `/account/orders/${payload.orderId}`,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.ORDER_RETURN_REQUESTED)
  async handleOrderReturnRequested(
    payload: OrderReturnRequestedPayload,
  ): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'ORDER',
      title: 'Return Requested',
      message: `A return was requested for order ${payload.orderId}.`,
      href: `/account/orders/${payload.orderId}`,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.ORDER_STATUS_CHANGED)
  async handleOrderStatusChanged(
    payload: OrderStatusChangedPayload,
  ): Promise<void> {
    const label =
      payload.status.charAt(0) + payload.status.slice(1).toLowerCase();
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'ORDER',
      title: `Order ${label}`,
      message: `Order ${payload.orderId} is now ${label.toLowerCase()}.`,
      href: `/account/orders/${payload.orderId}`,
    });
  }

  @OnEvent(PAYMENT_EVENTS.REFUNDED)
  async handlePaymentRefunded(payload: PaymentRefundedPayload): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'ORDER',
      title: 'Refund Processed',
      message: `₹${payload.amount.toFixed(2)} was refunded${payload.orderId ? ` for order ${payload.orderId}` : ''}.`,
      href: payload.orderId ? `/account/orders/${payload.orderId}` : undefined,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.RETURN_APPROVED)
  async handleReturnApproved(payload: ReturnApprovedPayload): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'ORDER',
      title: 'Return Approved',
      message: `Your return/DOA claim for order ${payload.orderId} was approved.`,
      href: `/account/orders/${payload.orderId}`,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.RETURN_REJECTED)
  async handleReturnRejected(payload: ReturnRejectedPayload): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'ORDER',
      title: 'Return Not Approved',
      message: `Your return/DOA claim for order ${payload.orderId} was not approved: ${payload.reason}`,
      href: `/account/orders/${payload.orderId}`,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.STORE_CREDIT_ISSUED)
  async handleStoreCreditIssued(
    payload: StoreCreditIssuedPayload,
  ): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'ORDER',
      title: 'Store Credit Issued',
      message: `₹${payload.amount.toFixed(2)} in store credit was issued for order ${payload.orderId}.`,
      href: `/account/orders/${payload.orderId}`,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.REPLACEMENT_ISSUED)
  async handleReplacementIssued(
    payload: ReplacementIssuedPayload,
  ): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'ORDER',
      title: 'Replacement On The Way',
      message: `A free replacement for order ${payload.orderId} was created as order ${payload.replacementOrderId}.`,
      href: `/account/orders/${payload.replacementOrderId}`,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.PROFILE_UPDATED)
  async handleProfileUpdated(payload: ProfileUpdatedPayload): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'ACCOUNT',
      title: 'Profile Updated',
      message: 'Your profile details were saved.',
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.PASSWORD_CHANGED)
  async handlePasswordChanged(payload: PasswordChangedPayload): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'SECURITY',
      title: 'Password Changed',
      message: 'Your password was updated successfully.',
    });
  }

  // --- Marketplace Phase 18 — seller lifecycle, seller-product moderation, payout paid ---

  @OnEvent(NOTIFICATION_EVENTS.SELLER_APPLIED)
  async handleSellerApplied(payload: SellerAppliedPayload): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'SELLER',
      title: 'Application Received',
      message: "We've received your seller application and will review it shortly.",
      href: '/seller/profile',
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.SELLER_APPROVED)
  async handleSellerApproved(payload: SellerApprovedPayload): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'SELLER',
      title: 'Seller Application Approved',
      message: "You're approved to sell on Folia — your storefront is now live.",
      href: '/seller/profile',
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.SELLER_REJECTED)
  async handleSellerRejected(payload: SellerRejectedPayload): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'SELLER',
      title: 'Seller Application Not Approved',
      message: `Your seller application was not approved: ${payload.reason}`,
      href: '/seller/profile',
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.SELLER_SUSPENDED)
  async handleSellerSuspended(payload: SellerSuspendedPayload): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'SELLER',
      title: 'Seller Account Suspended',
      message: payload.note
        ? `Your seller account was suspended: ${payload.note}`
        : 'Your seller account was suspended.',
      href: '/seller/profile',
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.SELLER_REACTIVATED)
  async handleSellerReactivated(
    payload: SellerReactivatedPayload,
  ): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'SELLER',
      title: 'Seller Account Reactivated',
      message: 'Your seller account is active again — your storefront is back online.',
      href: '/seller/profile',
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.SELLER_DEACTIVATED)
  async handleSellerDeactivated(
    payload: SellerDeactivatedPayload,
  ): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'SELLER',
      title: 'Seller Account Deactivated',
      message: payload.note
        ? `Your seller account was deactivated: ${payload.note}`
        : 'Your seller account was deactivated.',
      href: '/seller/profile',
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.PRODUCT_SUBMITTED)
  async handleProductSubmitted(
    payload: ProductSubmittedPayload,
  ): Promise<void> {
    const userId = await this.resolveSellerUserId(payload.sellerId);
    await this.notificationsService.create({
      userId,
      type: 'SELLER',
      title: 'Product Submitted For Review',
      message: 'Your product listing was submitted and is awaiting review.',
      href: `/seller/products/${payload.productId}`,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.PRODUCT_APPROVED)
  async handleProductApproved(
    payload: ProductApprovedPayload,
  ): Promise<void> {
    const userId = await this.resolveSellerUserId(payload.sellerId);
    await this.notificationsService.create({
      userId,
      type: 'SELLER',
      title: 'Product Approved',
      message: 'Your product listing was approved and is now live.',
      href: `/seller/products/${payload.productId}`,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.PRODUCT_REJECTED)
  async handleProductRejected(
    payload: ProductRejectedPayload,
  ): Promise<void> {
    const userId = await this.resolveSellerUserId(payload.sellerId);
    await this.notificationsService.create({
      userId,
      type: 'SELLER',
      title: 'Product Not Approved',
      message: `Your product listing was not approved: ${payload.reason}`,
      href: `/seller/products/${payload.productId}`,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.PRODUCT_DEACTIVATED)
  async handleProductDeactivated(
    payload: ProductDeactivatedPayload,
  ): Promise<void> {
    const userId = await this.resolveSellerUserId(payload.sellerId);
    await this.notificationsService.create({
      userId,
      type: 'SELLER',
      title: 'Product Archived',
      message: 'Your product listing was archived and is no longer live.',
      href: `/seller/products/${payload.productId}`,
    });
  }

  @OnEvent(NOTIFICATION_EVENTS.SELLER_PAYOUT_PAID)
  async handleSellerPayoutPaid(
    payload: SellerPayoutPaidPayload,
  ): Promise<void> {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'SELLER',
      title: 'Payout Sent',
      message: `₹${payload.amount.toFixed(2)} was paid out to you.`,
      href: '/seller/earnings',
    });
  }
}
