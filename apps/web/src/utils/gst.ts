/**
 * P0-F — India-commerce correctness. A real GST invoice must split tax
 * into CGST+SGST (intra-state — buyer and seller in the same state,
 * split evenly between the two) or a single IGST line (inter-state) —
 * never one undifferentiated "tax" line, which is what this project's
 * invoice showed before. This is a mechanical, well-defined split given
 * an already-computed tax AMOUNT; it does not decide what that amount
 * should be. This project has one hardcoded flat tax rate throughout
 * (apps/api/src/orders/order.types.ts's TAX_RATE, mirrored here at
 * apps/web/src/utils/pricing.ts) rather than real HSN-code-based GST
 * slabs (0/5/12/18/28%, varying by product category) — that remains a
 * known, documented gap (see docs/SECURITY_STATUS.md's P0-F notes):
 * fixing it needs real product-tax classification data this project
 * doesn't have, not an engineering guess. This util only makes the
 * SPLIT of whatever tax amount already exists correct, not the rate.
 */

export interface GstBreakdown {
  /** true = same state as the seller (intra-state, CGST+SGST); false = IGST. */
  intraState: boolean;
  cgst: number;
  sgst: number;
  igst: number;
}

/** Case/whitespace-insensitive — "Karnataka" and "karnataka " should match. */
function normalizeState(state: string): string {
  return state.trim().toLowerCase();
}

export function computeGstBreakdown(
  taxAmount: number,
  buyerState: string,
  sellerState: string,
): GstBreakdown {
  const intraState = normalizeState(buyerState) === normalizeState(sellerState);
  if (intraState) {
    const half = Math.round((taxAmount / 2) * 100) / 100;
    return { intraState, cgst: half, sgst: half, igst: 0 };
  }
  return { intraState, cgst: 0, sgst: 0, igst: taxAmount };
}
