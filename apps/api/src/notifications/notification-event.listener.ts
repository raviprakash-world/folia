import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_EVENTS } from './notification.events';
import type {
  OrderCancelledPayload,
  OrderReturnRequestedPayload,
  OrderStatusChangedPayload,
  ProfileUpdatedPayload,
  PasswordChangedPayload,
} from './notification.events';
import { ANALYTICS_EVENTS } from '../analytics/analytics.events';
import type { OrderCreatedPayload } from '../analytics/analytics.events';

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
  constructor(private readonly notificationsService: NotificationsService) {}

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
}
