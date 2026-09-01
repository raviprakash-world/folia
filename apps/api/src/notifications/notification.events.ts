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

export interface ProfileUpdatedPayload {
  userId: string;
}

export interface PasswordChangedPayload {
  userId: string;
}
