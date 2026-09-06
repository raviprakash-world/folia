/**
 * Same reasoning as analytics.events.ts's own doc comment — plain event
 * names/payloads only, no service/module imports, so any controller can
 * emit without creating a module dependency on NotificationsModule.
 * ORDER_CREATED is deliberately NOT redefined here — the existing
 * ANALYTICS_EVENTS.ORDER_CREATED (Phase 8) is reused directly for the
 * "Order Placed" notification, rather than emitting a second, redundant
 * event for the same real occurrence.
 */
export const NOTIFICATION_EVENTS = {
  ORDER_CANCELLED: 'notification.order_cancelled',
  ORDER_RETURN_REQUESTED: 'notification.order_return_requested',
  /**
   * Phase 3 — the forward fulfillment transitions (CONFIRMED/SHIPPED/
   * DELIVERED) an admin can set via OrdersService.adminUpdateStatus
   * genuinely happen in this system today (see order-status.util.ts's
   * ADMIN_SETTABLE_STATUSES) but, until now, nothing observed them —
   * they were the one part of the original notification spec explicitly
   * called dead code (see notification-event.listener.ts's prior
   * comment). Emitted from OrdersService itself, not a controller, since
   * that's the one place that already has both the new status and the
   * order's userId in scope without an extra query.
   */
  ORDER_STATUS_CHANGED: 'notification.order_status_changed',
  PROFILE_UPDATED: 'notification.profile_updated',
  PASSWORD_CHANGED: 'notification.password_changed',
} as const;

export interface OrderCancelledPayload {
  orderId: string;
  userId: string;
}

export interface OrderReturnRequestedPayload {
  orderId: string;
  userId: string;
}

export interface OrderStatusChangedPayload {
  orderId: string;
  userId: string;
  status: 'CONFIRMED' | 'SHIPPED' | 'DELIVERED';
}

export interface ProfileUpdatedPayload {
  userId: string;
}

export interface PasswordChangedPayload {
  userId: string;
}
