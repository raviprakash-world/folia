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
  /**
   * Phase 6D-4A — the admin decision on a return/DOA claim. Emitted from
   * ReturnsService itself (the one place that already has the claim's
   * orderId and the order's customer userId in scope right after the
   * atomic PENDING -> APPROVED/REJECTED transition, without an extra
   * query — same reasoning as ORDER_STATUS_CHANGED above). No listener
   * exists for either yet: this phase only adds the event names/payloads
   * and emits them, matching the "add the minimal domain events, don't
   * implement delivery" scope — a future phase wires the actual
   * notification/email.
   */
  RETURN_APPROVED: 'notification.return_approved',
  RETURN_REJECTED: 'notification.return_rejected',
  /**
   * Phase 6D-4B — a COD return/DOA claim's financial resolution. The
   * prepaid equivalent reuses the EXISTING PAYMENT_EVENTS.REFUNDED
   * (already fires from PaymentsService.refund() itself, with everything
   * a future notification needs — orderId/userId/paymentId/amount) rather
   * than adding a second, redundant event for the same real occurrence,
   * matching ORDER_STATUS_CHANGED/ORDER_CREATED's own precedent above.
   * COD store credit has no equivalent existing event at all — this is
   * the one genuinely new event this phase adds. No listener exists yet:
   * same "add the event, don't implement delivery" scope as
   * RETURN_APPROVED/REJECTED.
   */
  STORE_CREDIT_ISSUED: 'notification.store_credit_issued',
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

export interface ReturnApprovedPayload {
  returnRequestId: string;
  orderId: string;
  userId: string;
}

export interface ReturnRejectedPayload {
  returnRequestId: string;
  orderId: string;
  userId: string;
  /** The admin's required rejection reason (ReturnRequest.decisionNote). */
  reason: string;
}

export interface StoreCreditIssuedPayload {
  returnRequestId: string;
  orderId: string;
  userId: string;
  amount: number;
}

export interface ProfileUpdatedPayload {
  userId: string;
}

export interface PasswordChangedPayload {
  userId: string;
}
