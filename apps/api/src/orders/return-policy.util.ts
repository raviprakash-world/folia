import type { ReturnReasonDb } from './order.types';

/**
 * Pure eligibility rules for Phase 6D's return/DOA-claim system — no
 * database or NestJS imports, matching this codebase's existing
 * refund.util.ts/order-status.util.ts convention of keeping business
 * rules in small, directly-unit-testable functions rather than buried
 * inside a service. A future ReturnsService (Phase 6D-3+) is the only
 * intended caller; nothing here creates a ReturnRequest, touches the
 * database, or executes a refund/replacement/store-credit — see
 * docs/PHASE_6D_MIGRATION_DESIGN.md for the full design.
 *
 * Every window check below compares Date.getTime() values (UTC epoch
 * milliseconds) directly — never a calendar-day or local-timezone
 * comparison — matching this codebase's existing elapsed-time idiom (see
 * refund.util.ts's canReturnOrder, PaymentsService.expireStalePayments'
 * PAYMENT_EXPIRY_MINUTES cutoff). A calendar-based check would drift a
 * claim's real deadline by up to a day depending on the server's or a
 * customer's local timezone; epoch-millisecond arithmetic can't.
 */

export type ReturnClaimType = 'STANDARD_RETURN' | 'DOA_CLAIM';

const PLANT_CATEGORY_SLUG = 'plants';

/**
 * Business-rule constant, not a secret or environment-specific value —
 * same convention as TAX_RATE (order.types.ts) and PAYMENT_EXPIRY_MINUTES
 * (payments.service.ts): change this one exported value and redeploy to
 * change the deduction fleet-wide, rather than AppConfigService (reserved
 * for real external credentials/URLs). See docs/PHASE_6D_MIGRATION_DESIGN.md's
 * "Return-shipping deduction" section for the full reasoning.
 */
export const RETURN_SHIPPING_DEDUCTION_INR = 99;

export const STANDARD_RETURN_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
export const DOA_CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

const STANDARD_RETURN_REASONS: ReturnReasonDb[] = [
  'NO_LONGER_NEEDED',
  'WRONG_ITEM',
  'DAMAGED_IN_TRANSIT',
  'NOT_AS_DESCRIBED',
  'CHANGED_MIND',
  'OTHER',
];

/**
 * CHANGED_MIND is deliberately absent — live plants are never eligible
 * for an ordinary change-of-mind return, only DOA/damage/incorrect-item
 * claims (the locked business rule this whole claim type exists for).
 */
const DOA_CLAIM_REASONS: ReturnReasonDb[] = [
  'DOA',
  'DAMAGED_IN_TRANSIT',
  'WRONG_ITEM',
];

/**
 * Only these STANDARD_RETURN reasons are genuinely the customer's own
 * choice — WRONG_ITEM/DAMAGED_IN_TRANSIT/NOT_AS_DESCRIBED are Folia's
 * fault even for a non-plant item, so the return-shipping deduction never
 * applies to them either.
 */
const SHIPPING_DEDUCTION_REASONS: ReturnReasonDb[] = [
  'CHANGED_MIND',
  'NO_LONGER_NEEDED',
  'OTHER',
];

export interface ClaimLineItem {
  categorySlug: string;
}

/**
 * Derives which claim workflow applies from the SELECTED line items of a
 * claim only (never the whole order, and never accepted from the client —
 * matching this codebase's "never trust the client" convention already
 * established for payments). Returns 'MIXED' when the selection spans
 * both plant and non-plant items: their eligibility rules are
 * structurally different (window length, evidence, allowed reasons), so
 * one claim can't honestly represent both — the caller must reject the
 * request server-side and ask for two separate claims.
 *
 * Throws on an empty list — not a business-ineligibility outcome (those
 * are represented by return values, like 'MIXED'), but a genuine caller-
 * contract violation: there is no such thing as a claim about zero items.
 */
export function deriveClaimType(
  items: ClaimLineItem[],
): ReturnClaimType | 'MIXED' {
  if (items.length === 0) {
    throw new Error('A claim must include at least one line item.');
  }
  const hasPlant = items.some(
    (item) => item.categorySlug === PLANT_CATEGORY_SLUG,
  );
  const hasNonPlant = items.some(
    (item) => item.categorySlug !== PLANT_CATEGORY_SLUG,
  );
  if (hasPlant && hasNonPlant) return 'MIXED';
  return hasPlant ? 'DOA_CLAIM' : 'STANDARD_RETURN';
}

/**
 * Whether `reason` is one this claimType may be filed under — e.g. a
 * plant claim can never be CHANGED_MIND, and DOA never makes sense for a
 * non-plant STANDARD_RETURN (there is nothing that can arrive "dead" that
 * isn't alive to begin with).
 */
export function isReasonEligibleForClaimType(
  claimType: ReturnClaimType,
  reason: ReturnReasonDb,
): boolean {
  const allowed =
    claimType === 'DOA_CLAIM' ? DOA_CLAIM_REASONS : STANDARD_RETURN_REASONS;
  return allowed.includes(reason);
}

/**
 * True only once Order.deliveredAt is actually known (null means "not
 * delivered yet, or delivered before this column existed and never
 * backfilled" — either way, not eligible: there is no honest window to
 * measure from) and the real elapsed time since delivery is still inside
 * the claim type's window, inclusive of the exact boundary instant.
 * `now` is injectable for tests; defaults to the real current time.
 * Negative elapsed time (a `deliveredAt` somehow in the future — clock
 * skew or bad data) is treated as ineligible rather than "trivially
 * within the window," since it can never represent a real claim.
 */
export function isWithinReturnWindow(
  claimType: ReturnClaimType,
  deliveredAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!deliveredAt) return false;
  const windowMs =
    claimType === 'DOA_CLAIM' ? DOA_CLAIM_WINDOW_MS : STANDARD_RETURN_WINDOW_MS;
  const elapsedMs = now.getTime() - deliveredAt.getTime();
  return elapsedMs >= 0 && elapsedMs <= windowMs;
}

/** DOA/damage/incorrect-plant claims require photo/video evidence; an ordinary non-plant return does not. */
export function requiresEvidence(claimType: ReturnClaimType): boolean {
  return claimType === 'DOA_CLAIM';
}

/**
 * RETURN_SHIPPING_DEDUCTION_INR, only for a genuinely customer-caused
 * STANDARD_RETURN reason — never for DOA_CLAIM (never the customer's
 * fault) and never for a non-change-of-mind STANDARD_RETURN reason.
 */
export function calculateShippingDeduction(
  claimType: ReturnClaimType,
  reason: ReturnReasonDb,
): number {
  if (claimType !== 'STANDARD_RETURN') return 0;
  return SHIPPING_DEDUCTION_REASONS.includes(reason)
    ? RETURN_SHIPPING_DEDUCTION_INR
    : 0;
}

export interface RefundCalculationInput {
  claimType: ReturnClaimType;
  reason: ReturnReasonDb;
  /** Order.subtotal — the whole order's pre-discount/tax item total. */
  orderSubtotal: number;
  /** Order.discount — the whole order's coupon/discount amount. */
  orderDiscount: number;
  /** Order.tax — the whole order's tax amount, computed uniformly as a flat rate of (subtotal - discount) at checkout time. */
  orderTax: number;
  /** sum(orderItem.price * claimedQuantity) across only the items/quantities THIS claim covers — never the whole order. */
  eligibleItemSubtotal: number;
}

/**
 * The canonical, Phase-6C-approved partial-return refund/store-credit
 * calculation — the ONE place this formula is implemented (Phase 6D-4B
 * is its first real caller; nothing before this phase needed it). Pure
 * and side-effect-free like every other function in this file: no DB, no
 * rounding-mode surprises hidden inside a service. Reuses
 * calculateShippingDeduction above rather than re-deriving the ₹99 rule.
 *
 * proportion = eligibleItemSubtotal / orderSubtotal — valid because
 * Order.tax was itself computed as a flat rate of (subtotal - discount)
 * uniformly across every line at checkout time (see order.types.ts's
 * TAX_RATE / OrdersService.checkout), so the same proportion applies
 * exactly to both discount and tax for a subset of lines. Original
 * outbound shippingCost is never refunded (a sunk fulfillment cost
 * regardless of what's returned) — shippingRefund is always 0, not a
 * parameter, so there is no way to accidentally include it.
 */
export function calculateRefundAmount(input: RefundCalculationInput): number {
  if (input.orderSubtotal <= 0 || input.eligibleItemSubtotal <= 0) return 0;

  const proportion = input.eligibleItemSubtotal / input.orderSubtotal;
  const proratedDiscount = input.orderDiscount * proportion;
  const proratedTax = input.orderTax * proportion;
  const itemLevelRefund =
    input.eligibleItemSubtotal - proratedDiscount + proratedTax;
  const deduction = calculateShippingDeduction(input.claimType, input.reason);
  const final = Math.max(0, itemLevelRefund - deduction);

  // Rounded to 2 decimal places — matches this schema's Decimal(10, 2)
  // storage precision for every money field (Order.total, Payment.amount,
  // Refund.amount, ReturnRequest.refundAmount, StoreCreditEntry.amount).
  return Math.round(final * 100) / 100;
}
