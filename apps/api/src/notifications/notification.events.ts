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
  /**
   * Phase 6D-4C — a DOA/damage claim resolved by shipping a free
   * replacement order instead of a refund/store-credit. No existing event
   * covers order creation for a $0, no-charge order (ANALYTICS_EVENTS.
   * ORDER_CREATED is deliberately NOT reused here — a replacement isn't a
   * new sale, and firing it would misrepresent the replacement as revenue-
   * bearing order-count activity). No listener exists yet: same "add the
   * event, don't implement delivery" scope as STORE_CREDIT_ISSUED.
   */
  REPLACEMENT_ISSUED: 'notification.replacement_issued',
  PROFILE_UPDATED: 'notification.profile_updated',
  PASSWORD_CHANGED: 'notification.password_changed',
  /**
   * Marketplace Phase 2 — the seller-onboarding lifecycle. Emitted from
   * SellersService itself at each real transition (apply, and every admin
   * decision), same reasoning as ORDER_STATUS_CHANGED/RETURN_APPROVED
   * above. Real listeners for these are deferred to a later marketplace
   * phase — matching this exact codebase's own established precedent
   * (RETURN_APPROVED/RETURN_REJECTED/STORE_CREDIT_ISSUED/
   * REPLACEMENT_ISSUED above all shipped with "no listener exists yet" in
   * their own originating phase too) — not a shortcut invented for this
   * phase.
   */
  SELLER_APPLIED: 'notification.seller_applied',
  SELLER_APPROVED: 'notification.seller_approved',
  SELLER_REJECTED: 'notification.seller_rejected',
  SELLER_SUSPENDED: 'notification.seller_suspended',
  SELLER_REACTIVATED: 'notification.seller_reactivated',
  SELLER_DEACTIVATED: 'notification.seller_deactivated',
  /**
   * Marketplace Phase 3 — the seller product moderation lifecycle. Same
   * "emit now, listener deferred" precedent as the Phase 2 SELLER_*
   * events above. PRODUCT_REJECTED covers both SellerProductsService.
   * adminReject and adminRequestChanges (they share one mechanism — see
   * RejectSellerProductDto's own comment) — a future listener reads
   * whichever admin action name is on the paired audit log entry if it
   * ever needs to distinguish the two in a notification's wording.
   */
  PRODUCT_SUBMITTED: 'notification.product_submitted',
  PRODUCT_APPROVED: 'notification.product_approved',
  PRODUCT_REJECTED: 'notification.product_rejected',
  PRODUCT_DEACTIVATED: 'notification.product_deactivated',
} as const;

export interface OrderCancelledPayload {
  orderId: string;
  userId: string;
}

export interface SellerAppliedPayload {
  sellerId: string;
  userId: string;
}

export interface SellerApprovedPayload {
  sellerId: string;
  userId: string;
}

export interface SellerRejectedPayload {
  sellerId: string;
  userId: string;
  reason: string;
}

export interface SellerSuspendedPayload {
  sellerId: string;
  userId: string;
  note?: string;
}

export interface SellerReactivatedPayload {
  sellerId: string;
  userId: string;
}

export interface SellerDeactivatedPayload {
  sellerId: string;
  userId: string;
  note?: string;
}

export interface ProductSubmittedPayload {
  productId: string;
  sellerId: string;
}

export interface ProductApprovedPayload {
  productId: string;
  sellerId: string;
}

export interface ProductRejectedPayload {
  productId: string;
  sellerId: string;
  reason: string;
}

export interface ProductDeactivatedPayload {
  productId: string;
  sellerId: string;
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

export interface ReplacementIssuedPayload {
  returnRequestId: string;
  /** The original order the claim was filed against. */
  orderId: string;
  /** The new $0 order created to fulfill the replacement. */
  replacementOrderId: string;
  userId: string;
}

export interface ProfileUpdatedPayload {
  userId: string;
}

export interface PasswordChangedPayload {
  userId: string;
}
